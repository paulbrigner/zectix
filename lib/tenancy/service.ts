import { randomUUID } from "node:crypto";
import {
  getCalendarConnection,
  getCalendarConnectionBySlug,
  getCipherPayConnection,
  getCipherPayConnectionByCalendar,
  getEventMirror,
  getTenant,
  getTenantBySlug,
  getTicketMirror,
  listCalendarConnectionsByTenant,
  listCipherPayConnectionsByTenant,
  listEventMirrorsByCalendar,
  listRegistrationTasksByTenant,
  listSessionsByTenant,
  listTicketMirrorsByEvent,
  listWebhookDeliveriesByTenant,
  putCalendarConnection,
  putCipherPayConnection,
  putEventMirror,
  putTenant,
  putTicketMirror,
} from "@/lib/app-state/state";
import type {
  CalendarConnection,
  CipherPayConnection,
  EventMirror,
  EventMirrorStatus,
  SecretPreview,
  Tenant,
  TenantStatus,
  TicketMirror,
} from "@/lib/app-state/types";
import {
  cipherPayDefaultsForNetwork,
  maskSecretPreview,
  nowIso,
  slugify,
} from "@/lib/app-state/utils";
import type { CipherPayClientConfig } from "@/lib/cipherpay";
import { evaluateTicketEligibility } from "@/lib/eligibility/ticket-eligibility";
import { getSecretStore } from "@/lib/secrets";
import {
  ensureCalendarConnectionWebhookSubscription,
  syncCalendarConnection,
  validateCalendarConnection,
} from "@/lib/sync/luma-sync";
import { deleteLumaWebhook, listLumaEvents } from "@/lib/luma";
import type { LumaEvent } from "@/lib/luma";

async function dedupeSlug(
  baseSlug: string,
  lookup: (slug: string) => Promise<unknown>,
) {
  let attempt = slugify(baseSlug);
  let suffix = 1;
  while (await lookup(attempt)) {
    suffix += 1;
    attempt = `${slugify(baseSlug)}-${suffix}`;
  }
  return attempt;
}

async function getSecretPreview(ref: string | null): Promise<SecretPreview> {
  if (!ref) {
    return {
      ref: null,
      preview: null,
      has_value: false,
    };
  }

  const value = await getSecretStore().getSecret(ref);
  return {
    ref,
    preview: maskSecretPreview(value),
    has_value: Boolean(value),
  };
}

export type EventSyncFocus = "mirrored" | "upstream";
export type EventSyncOutcome =
  | "imported"
  | "updated"
  | "unchanged"
  | "hidden"
  | "canceled"
  | "missing";

export type FocusedEventSyncReview = {
  tenant_id: string;
  calendar_connection_id: string;
  event_api_id: string;
  event_name: string;
  focus: EventSyncFocus;
  outcome: EventSyncOutcome;
  sync_status: EventMirrorStatus | "missing";
  tickets_added: number;
  tickets_removed: number;
  mirrored_ticket_count: number;
  enabled_ticket_count: number;
  public_checkout_enabled: boolean;
  happened_at: string;
};

type EventSyncSnapshot = {
  event: EventMirror | null;
  tickets: TicketMirror[];
};

async function loadEventSyncSnapshot(
  calendarConnectionId: string,
  eventApiId: string,
): Promise<EventSyncSnapshot> {
  const event = await getEventMirror(calendarConnectionId, eventApiId);
  return {
    event,
    tickets: event ? await listTicketMirrorsByEvent(eventApiId) : [],
  };
}

function activeTicketTypeIds(tickets: TicketMirror[]) {
  return new Set(
    tickets.filter((ticket) => ticket.active).map((ticket) => ticket.ticket_type_api_id),
  );
}

function didMirroredEventChange(before: EventMirror | null, after: EventMirror | null) {
  if (!before || !after) {
    return false;
  }

  return (
    before.name !== after.name ||
    before.start_at !== after.start_at ||
    before.end_at !== after.end_at ||
    before.timezone !== after.timezone ||
    before.description !== after.description ||
    before.cover_url !== after.cover_url ||
    before.url !== after.url ||
    before.location_label !== after.location_label ||
    before.location_note !== after.location_note ||
    before.sync_status !== after.sync_status ||
    before.zcash_enabled !== after.zcash_enabled ||
    before.zcash_enabled_reason !== after.zcash_enabled_reason
  );
}

export function buildFocusedEventSyncReview(input: {
  tenant_id: string;
  calendar_connection_id: string;
  event_api_id: string;
  event_name: string;
  focus: EventSyncFocus;
  before: EventSyncSnapshot;
  after: EventSyncSnapshot;
  happened_at: string;
}): FocusedEventSyncReview {
  const beforeActiveTicketIds = activeTicketTypeIds(input.before.tickets);
  const afterActiveTicketIds = activeTicketTypeIds(input.after.tickets);
  const ticketsAdded = [...afterActiveTicketIds].filter(
    (ticketTypeId) => !beforeActiveTicketIds.has(ticketTypeId),
  ).length;
  const ticketsRemoved = [...beforeActiveTicketIds].filter(
    (ticketTypeId) => !afterActiveTicketIds.has(ticketTypeId),
  ).length;

  let outcome: EventSyncOutcome;
  if (!input.after.event) {
    outcome = "missing";
  } else if (!input.before.event) {
    outcome = "imported";
  } else if (input.after.event.sync_status === "canceled") {
    outcome = "canceled";
  } else if (input.after.event.sync_status === "hidden") {
    outcome = "hidden";
  } else if (
    didMirroredEventChange(input.before.event, input.after.event) ||
    ticketsAdded > 0 ||
    ticketsRemoved > 0
  ) {
    outcome = "updated";
  } else {
    outcome = "unchanged";
  }

  return {
    tenant_id: input.tenant_id,
    calendar_connection_id: input.calendar_connection_id,
    event_api_id: input.event_api_id,
    event_name: input.after.event?.name || input.before.event?.name || input.event_name,
    focus: input.focus,
    outcome,
    sync_status: input.after.event?.sync_status || "missing",
    tickets_added: ticketsAdded,
    tickets_removed: ticketsRemoved,
    mirrored_ticket_count: input.after.tickets.length,
    enabled_ticket_count: input.after.tickets.filter((ticket) => ticket.zcash_enabled).length,
    public_checkout_enabled: input.after.event?.zcash_enabled || false,
    happened_at: input.happened_at,
  };
}

export async function createTenant(input: {
  name: string;
  slug?: string | null;
  contact_email: string;
  monthly_minimum_usd_cents?: number;
  service_fee_bps?: number;
  pilot_notes?: string | null;
}) {
  const timestamp = nowIso();
  const slug = await dedupeSlug(
    input.slug || input.name,
    async (candidate) => getTenantBySlug(candidate),
  );

  const tenant: Tenant = {
    tenant_id: randomUUID(),
    name: input.name.trim(),
    slug,
    contact_email: input.contact_email.trim(),
    status: "draft",
    monthly_minimum_usd_cents: input.monthly_minimum_usd_cents || 0,
    service_fee_bps: input.service_fee_bps || 0,
    pilot_notes: input.pilot_notes?.trim() || null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  return putTenant(tenant);
}

export async function setTenantStatus(tenantId: string, status: TenantStatus) {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    throw new Error(`Tenant ${tenantId} was not found.`);
  }

  const nextTenant: Tenant = {
    ...tenant,
    status,
    updated_at: nowIso(),
  };

  return putTenant(nextTenant);
}

export async function createCalendarConnection(input: {
  tenant_id: string;
  display_name: string;
  slug?: string | null;
  luma_api_key: string;
}) {
  const timestamp = nowIso();
  const slug = await dedupeSlug(
    input.slug || input.display_name,
    async (candidate) => getCalendarConnectionBySlug(candidate),
  );
  const lumaApiSecretRef = await getSecretStore().setSecret(null, input.luma_api_key);

  const connection: CalendarConnection = {
    calendar_connection_id: randomUUID(),
    tenant_id: input.tenant_id,
    slug,
    display_name: input.display_name.trim(),
    status: "pending_validation",
    luma_api_secret_ref: lumaApiSecretRef,
    luma_webhook_secret_ref: null,
    luma_webhook_token_ref: null,
    luma_webhook_id: null,
    last_validated_at: null,
    last_synced_at: null,
    last_sync_error: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  return putCalendarConnection(connection);
}

export async function updateCalendarConnectionLumaKey(
  calendarConnectionId: string,
  lumaApiKey: string,
) {
  const connection = await getCalendarConnection(calendarConnectionId);
  if (!connection) {
    throw new Error(`Calendar connection ${calendarConnectionId} was not found.`);
  }

  const lumaApiSecretRef = await getSecretStore().setSecret(
    connection.luma_api_secret_ref || null,
    lumaApiKey,
  );

  const nextConnection: CalendarConnection = {
    ...connection,
    luma_api_secret_ref: lumaApiSecretRef,
    luma_webhook_secret_ref: null,
    luma_webhook_token_ref: null,
    luma_webhook_id: null,
    last_validated_at: null,
    last_sync_error: null,
    updated_at: nowIso(),
  };

  return putCalendarConnection(nextConnection);
}

export async function disableCalendarConnection(calendarConnectionId: string) {
  const connection = await getCalendarConnection(calendarConnectionId);
  if (!connection) {
    throw new Error(`Calendar connection ${calendarConnectionId} was not found.`);
  }

  const secretStore = getSecretStore();
  const lumaApiKey = connection.luma_api_secret_ref
    ? await secretStore.getSecret(connection.luma_api_secret_ref)
    : null;

  if (lumaApiKey && connection.luma_webhook_id) {
    try {
      await deleteLumaWebhook({
        apiKey: lumaApiKey,
        id: connection.luma_webhook_id,
      });
    } catch {
      // Continue disabling locally even if the upstream webhook was already removed.
    }
  }

  const nextConnection: CalendarConnection = {
    ...connection,
    status: "disabled",
    luma_webhook_secret_ref: null,
    luma_webhook_token_ref: null,
    luma_webhook_id: null,
    last_sync_error: null,
    updated_at: nowIso(),
  };

  return putCalendarConnection(nextConnection);
}

export async function createCipherPayConnection(input: {
  tenant_id: string;
  calendar_connection_id: string;
  network: "testnet" | "mainnet";
  api_base_url?: string | null;
  checkout_base_url?: string | null;
  cipherpay_api_key: string;
  cipherpay_webhook_secret: string;
}) {
  const timestamp = nowIso();
  const defaults = cipherPayDefaultsForNetwork(input.network);
  const existingConnection = await getCipherPayConnectionByCalendar(
    input.calendar_connection_id,
  );
  if (existingConnection && existingConnection.tenant_id !== input.tenant_id) {
    throw new Error(
      "That calendar is already attached to a different tenant's CipherPay connection.",
    );
  }

  const apiSecretRef = await getSecretStore().setSecret(
    existingConnection?.cipherpay_api_secret_ref || null,
    input.cipherpay_api_key,
  );
  const webhookSecretRef = await getSecretStore().setSecret(
    existingConnection?.cipherpay_webhook_secret_ref || null,
    input.cipherpay_webhook_secret,
  );

  const connection: CipherPayConnection = existingConnection
    ? {
        ...existingConnection,
        network: input.network,
        api_base_url: input.api_base_url?.trim() || defaults.apiBaseUrl,
        checkout_base_url: input.checkout_base_url?.trim() || defaults.checkoutBaseUrl,
        cipherpay_api_secret_ref: apiSecretRef,
        cipherpay_webhook_secret_ref: webhookSecretRef,
        status: "pending_validation",
        last_validated_at: null,
        last_validation_error: null,
        updated_at: timestamp,
      }
    : {
        cipherpay_connection_id: randomUUID(),
        tenant_id: input.tenant_id,
        calendar_connection_id: input.calendar_connection_id,
        network: input.network,
        api_base_url: input.api_base_url?.trim() || defaults.apiBaseUrl,
        checkout_base_url: input.checkout_base_url?.trim() || defaults.checkoutBaseUrl,
        cipherpay_api_secret_ref: apiSecretRef,
        cipherpay_webhook_secret_ref: webhookSecretRef,
        status: "pending_validation",
        last_validated_at: null,
        last_validation_error: null,
        created_at: timestamp,
        updated_at: timestamp,
      };

  return putCipherPayConnection(connection);
}

export async function validateCipherPayConnection(cipherpayConnectionId: string) {
  const connection = await getCipherPayConnection(cipherpayConnectionId);
  if (!connection) {
    throw new Error(`CipherPay connection ${cipherpayConnectionId} was not found.`);
  }

  const [apiKey, webhookSecret] = await Promise.all([
    connection.cipherpay_api_secret_ref
      ? getSecretStore().getSecret(connection.cipherpay_api_secret_ref)
      : null,
    connection.cipherpay_webhook_secret_ref
      ? getSecretStore().getSecret(connection.cipherpay_webhook_secret_ref)
      : null,
  ]);

  if (!apiKey || !webhookSecret) {
    throw new Error("CipherPay secrets are incomplete for this connection.");
  }

  const next = {
    ...connection,
    status: "active" as const,
    last_validated_at: nowIso(),
    last_validation_error: null,
    updated_at: nowIso(),
  };
  await putCipherPayConnection(next, { attachToCalendar: false });
  return next;
}

export async function validateAndSyncCalendar(calendarConnectionId: string) {
  await validateCalendarConnection(calendarConnectionId);
  await ensureCalendarConnectionWebhookSubscription(calendarConnectionId);
  return syncCalendarConnection(calendarConnectionId);
}

export async function syncCalendarEventForOps(input: {
  calendar_connection_id: string;
  event_api_id: string;
  event_name: string;
  focus: EventSyncFocus;
}) {
  const connection = await getCalendarConnection(input.calendar_connection_id);
  if (!connection) {
    throw new Error(
      `Calendar connection ${input.calendar_connection_id} was not found.`,
    );
  }

  const before = await loadEventSyncSnapshot(
    connection.calendar_connection_id,
    input.event_api_id,
  );
  const syncResult = await syncCalendarConnection(connection.calendar_connection_id);
  const syncedEvent =
    syncResult.events.find((event) => event.event_api_id === input.event_api_id) || null;
  const after = syncedEvent
    ? {
        event: syncedEvent,
        tickets: await listTicketMirrorsByEvent(input.event_api_id),
      }
    : await loadEventSyncSnapshot(connection.calendar_connection_id, input.event_api_id);

  return {
    connection: syncResult.connection,
    review: buildFocusedEventSyncReview({
      tenant_id: connection.tenant_id,
      calendar_connection_id: connection.calendar_connection_id,
      event_api_id: input.event_api_id,
      event_name: input.event_name,
      focus: input.focus,
      before,
      after,
      happened_at: syncResult.connection.last_synced_at || nowIso(),
    }),
  };
}

export async function resolveLumaApiKeyForCalendar(calendarConnectionId: string) {
  const calendar = await getCalendarConnection(calendarConnectionId);
  if (!calendar?.luma_api_secret_ref) {
    throw new Error("Luma API secret is not configured for this calendar connection.");
  }

  const apiKey = await getSecretStore().getSecret(calendar.luma_api_secret_ref);
  if (!apiKey) {
    throw new Error("Luma API secret could not be resolved from the secret store.");
  }

  return apiKey;
}

export async function resolveCipherPayClientForCalendar(
  calendarConnectionId: string,
): Promise<CipherPayClientConfig> {
  const connection = await getCipherPayConnectionByCalendar(calendarConnectionId);
  if (!connection || connection.status !== "active") {
    throw new Error("An active CipherPay connection is required for this calendar.");
  }

  if (!connection.cipherpay_api_secret_ref) {
    throw new Error("CipherPay API secret ref is missing for this calendar.");
  }

  const apiKey = await getSecretStore().getSecret(connection.cipherpay_api_secret_ref);
  if (!apiKey) {
    throw new Error("CipherPay API secret could not be resolved from the secret store.");
  }

  return {
    network: connection.network,
    api_base_url: connection.api_base_url,
    checkout_base_url: connection.checkout_base_url,
    api_key: apiKey,
  };
}

export async function resolveCipherPayWebhookSecretForCalendar(
  calendarConnectionId: string,
) {
  const connection = await getCipherPayConnectionByCalendar(calendarConnectionId);
  if (!connection?.cipherpay_webhook_secret_ref) {
    return null;
  }

  return getSecretStore().getSecret(connection.cipherpay_webhook_secret_ref);
}

export async function setTicketOperatorAssertions(input: {
  event_api_id: string;
  ticket_type_api_id: string;
  confirmed_fixed_price: boolean;
  confirmed_no_approval_required: boolean;
  confirmed_no_extra_required_questions: boolean;
}) {
  const ticket = await getTicketMirror(input.event_api_id, input.ticket_type_api_id);
  if (!ticket) {
    throw new Error("Ticket mirror was not found.");
  }

  const eligibility = evaluateTicketEligibility({
    ...ticket,
    ...input,
  });
  const nextTicket: TicketMirror = {
    ...ticket,
    ...input,
    ...eligibility,
    updated_at: nowIso(),
  };
  await putTicketMirror(nextTicket);

  const tickets = await listTicketMirrorsByEvent(ticket.event_api_id);
  const event = await getEventMirror(ticket.calendar_connection_id, ticket.event_api_id);
  if (event) {
    await putEventMirror({
      ...event,
      zcash_enabled: tickets.some((entry) => entry.zcash_enabled),
      zcash_enabled_reason: tickets.some((entry) => entry.zcash_enabled)
        ? "At least one ticket is enabled for Zcash checkout."
        : "No tickets are currently enabled for managed Zcash checkout.",
      updated_at: nowIso(),
    });
  }

  return nextTicket;
}

export async function getTenantOpsDetail(tenantId: string) {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return null;
  }

  const [calendars, cipherpayConnections, sessions, webhooks, tasks] =
    await Promise.all([
      listCalendarConnectionsByTenant(tenantId),
      listCipherPayConnectionsByTenant(tenantId),
      listSessionsByTenant(tenantId, 100),
      listWebhookDeliveriesByTenant(tenantId, 100),
      listRegistrationTasksByTenant(tenantId, 100),
    ]);

  const events = await Promise.all(
    calendars.map(async (calendar) => ({
      calendar,
      events: await listEventMirrorsByCalendar(calendar.calendar_connection_id),
    })),
  );
  const ticketsByEvent = new Map<string, TicketMirror[]>();
  for (const entry of events) {
    for (const event of entry.events) {
      ticketsByEvent.set(event.event_api_id, await listTicketMirrorsByEvent(event.event_api_id));
    }
  }

  const calendarSecretPreviews = new Map<
    string,
    { luma: SecretPreview; lumaWebhook: SecretPreview }
  >();
  for (const calendar of calendars) {
    calendarSecretPreviews.set(calendar.calendar_connection_id, {
      luma: await getSecretPreview(calendar.luma_api_secret_ref),
      lumaWebhook: await getSecretPreview(calendar.luma_webhook_secret_ref),
    });
  }

  const cipherPaySecretPreviews = new Map<
    string,
    { api: SecretPreview; webhook: SecretPreview }
  >();
  for (const connection of cipherpayConnections) {
    cipherPaySecretPreviews.set(connection.cipherpay_connection_id, {
      api: await getSecretPreview(connection.cipherpay_api_secret_ref),
      webhook: await getSecretPreview(connection.cipherpay_webhook_secret_ref),
    });
  }

  const upstreamLumaEventsByCalendar = new Map<
    string,
    { events: LumaEvent[]; error: string | null }
  >(
    await Promise.all(
      calendars.map(async (calendar) => {
        if (!calendar.luma_api_secret_ref) {
          return [
            calendar.calendar_connection_id,
            {
              events: [] as LumaEvent[],
              error: "Luma API key is not configured yet.",
            },
          ] as const;
        }

        try {
          const apiKey = await getSecretStore().getSecret(calendar.luma_api_secret_ref);
          if (!apiKey) {
            return [
              calendar.calendar_connection_id,
              {
                events: [] as LumaEvent[],
                error: "Luma API key could not be resolved from the secret store.",
              },
            ] as const;
          }

          const events = await listLumaEvents(apiKey);
          return [
            calendar.calendar_connection_id,
            {
              events: events.sort(
                (left, right) =>
                  new Date(left.start_at).getTime() - new Date(right.start_at).getTime(),
              ),
              error: null,
            },
          ] as const;
        } catch (error) {
          return [
            calendar.calendar_connection_id,
            {
              events: [] as LumaEvent[],
              error:
                error instanceof Error
                  ? error.message
                  : "Could not load current Luma events for review.",
            },
          ] as const;
        }
      }),
    ),
  );

  const activeCipherPayConnectionsByCalendar = new Map<string, CipherPayConnection>();
  for (const calendar of calendars) {
    const connection = await getCipherPayConnectionByCalendar(calendar.calendar_connection_id);
    if (connection) {
      activeCipherPayConnectionsByCalendar.set(calendar.calendar_connection_id, connection);
    }
  }

  return {
    tenant,
    calendars,
    cipherpay_connections: cipherpayConnections,
    sessions,
    webhooks,
    tasks,
    events,
    tickets_by_event: ticketsByEvent,
    calendar_secret_previews: calendarSecretPreviews,
    cipherpay_secret_previews: cipherPaySecretPreviews,
    upstream_luma_events_by_calendar: upstreamLumaEventsByCalendar,
    active_cipherpay_connections_by_calendar: activeCipherPayConnectionsByCalendar,
  };
}

export type TenantOpsDetail = NonNullable<Awaited<ReturnType<typeof getTenantOpsDetail>>>;
