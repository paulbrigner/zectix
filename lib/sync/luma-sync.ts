import { createHash } from "node:crypto";
import {
  getCalendarConnection,
  listEventMirrorsByCalendar,
  listTicketMirrorsByEvent,
  putCalendarConnection,
  putEventMirror,
  putTicketMirror,
} from "@/lib/app-state/state";
import type { EventMirror, TicketMirror } from "@/lib/app-state/types";
import { nowIso } from "@/lib/app-state/utils";
import { appUrl } from "@/lib/app-paths";
import { evaluateTicketEligibility } from "@/lib/eligibility/ticket-eligibility";
import {
  createLumaWebhook,
  deleteLumaWebhook,
  listLumaEvents,
  listLumaTicketTypes,
  listLumaWebhooks,
  LUMA_MANAGED_EVENT_WEBHOOK_TYPES,
  updateLumaWebhook,
} from "@/lib/luma";
import type { LumaWebhook } from "@/lib/luma";
import { logEvent } from "@/lib/observability";
import { getSecretStore } from "@/lib/secrets";

function requireLumaApiSecretRef(ref: string | null) {
  if (!ref) {
    throw new Error("Luma API secret has not been saved for this calendar connection.");
  }

  return ref;
}

function safeJsonHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function eventTypesMatch(current: string[], expected: readonly string[]) {
  if (current.length !== expected.length) {
    return false;
  }

  const left = [...current].sort();
  const right = [...expected].sort();
  return left.every((value, index) => value === right[index]);
}

function lumaWebhookCallbackUrl(calendarConnectionId: string) {
  const url = appUrl(
    `/api/luma/webhook?calendar_connection_id=${encodeURIComponent(calendarConnectionId)}`,
  );
  if (!url) {
    throw new Error(
      "APP_PUBLIC_ORIGIN (or an equivalent deployment URL) is required to auto-register Luma webhooks.",
    );
  }

  return url;
}

async function listAllLumaWebhooks(apiKey: string) {
  const entries: LumaWebhook[] = [];
  let cursor: string | null = null;

  for (;;) {
    const page = await listLumaWebhooks(apiKey, cursor);
    entries.push(...page.entries);
    if (!page.has_more || !page.next_cursor) {
      break;
    }
    cursor = page.next_cursor;
  }

  return entries;
}

function baseTicketMirror(
  existing: TicketMirror | null,
  input: {
    tenant_id: string;
    calendar_connection_id: string;
    event_api_id: string;
    ticket_type_api_id: string;
    name: string;
    currency: string | null;
    amount: number | null;
    description: string | null;
    active: boolean;
    price_source: "amount" | "fallback";
  },
) {
  const timestamp = nowIso();
  return {
    ticket_mirror_id:
      existing?.ticket_mirror_id || `${input.event_api_id}:${input.ticket_type_api_id}`,
    tenant_id: input.tenant_id,
    calendar_connection_id: input.calendar_connection_id,
    event_api_id: input.event_api_id,
    ticket_type_api_id: input.ticket_type_api_id,
    name: input.name,
    currency: input.currency,
    amount: input.amount,
    description: input.description,
    active: input.active,
    price_source: input.price_source,
    confirmed_fixed_price: existing?.confirmed_fixed_price || false,
    confirmed_no_approval_required: existing?.confirmed_no_approval_required || false,
    confirmed_no_extra_required_questions:
      existing?.confirmed_no_extra_required_questions || false,
    zcash_enabled: existing?.zcash_enabled || false,
    zcash_enabled_reason: existing?.zcash_enabled_reason || null,
    automatic_eligibility_status:
      existing?.automatic_eligibility_status || "ineligible",
    automatic_eligibility_reasons: existing?.automatic_eligibility_reasons || [],
    created_at: existing?.created_at || timestamp,
    updated_at: timestamp,
  } satisfies TicketMirror;
}

async function syncTicketMirrorsForEvent(args: {
  tenant_id: string;
  calendar_connection_id: string;
  event_api_id: string;
  luma_api_key: string;
}) {
  const existingTickets = await listTicketMirrorsByEvent(args.event_api_id);
  const existingById = new Map(
    existingTickets.map((ticket) => [ticket.ticket_type_api_id, ticket]),
  );
  const seenIds = new Set<string>();

  const lumaTickets = await listLumaTicketTypes(args.luma_api_key, args.event_api_id).catch(
    () => [],
  );
  const syncedTickets: TicketMirror[] = [];

  for (const ticket of lumaTickets) {
    seenIds.add(ticket.api_id);
    const current = existingById.get(ticket.api_id) || null;
    const nextBase = baseTicketMirror(current, {
      tenant_id: args.tenant_id,
      calendar_connection_id: args.calendar_connection_id,
      event_api_id: args.event_api_id,
      ticket_type_api_id: ticket.api_id,
      name: ticket.name,
      currency: ticket.currency,
      amount: ticket.amount,
      description: ticket.description,
      active: ticket.active,
      price_source: ticket.price_source,
    });
    const eligibility = evaluateTicketEligibility(nextBase);
    const next: TicketMirror = {
      ...nextBase,
      ...eligibility,
    };
    syncedTickets.push(await putTicketMirror(next));
  }

  for (const existing of existingTickets) {
    if (seenIds.has(existing.ticket_type_api_id)) {
      continue;
    }

    syncedTickets.push(
      await putTicketMirror({
        ...existing,
        active: false,
        zcash_enabled: false,
        zcash_enabled_reason: "Ticket no longer appears in the latest Luma sync.",
        automatic_eligibility_status: "ineligible",
        automatic_eligibility_reasons: [
          "Ticket no longer appears in the latest Luma sync.",
        ],
        updated_at: nowIso(),
      }),
    );
  }

  return syncedTickets;
}

export async function validateCalendarConnection(calendarConnectionId: string) {
  const connection = await getCalendarConnection(calendarConnectionId);
  if (!connection) {
    throw new Error(`Calendar connection ${calendarConnectionId} was not found.`);
  }

  const lumaApiKey = await getSecretStore().getSecret(
    requireLumaApiSecretRef(connection.luma_api_secret_ref),
  );
  if (!lumaApiKey) {
    throw new Error("Luma API secret could not be resolved from the secret store.");
  }

  await listLumaEvents(lumaApiKey);
  const next = {
    ...connection,
    status: "active" as const,
    last_validated_at: nowIso(),
    last_sync_error: null,
    updated_at: nowIso(),
  };
  await putCalendarConnection(next);
  return next;
}

export async function ensureCalendarConnectionWebhookSubscription(
  calendarConnectionId: string,
) {
  const connection = await getCalendarConnection(calendarConnectionId);
  if (!connection) {
    throw new Error(`Calendar connection ${calendarConnectionId} was not found.`);
  }

  const secretStore = getSecretStore();
  const lumaApiKey = await secretStore.getSecret(
    requireLumaApiSecretRef(connection.luma_api_secret_ref),
  );
  if (!lumaApiKey) {
    throw new Error("Luma API secret could not be resolved from the secret store.");
  }

  const callbackUrl = lumaWebhookCallbackUrl(connection.calendar_connection_id);
  const existingSecret = connection.luma_webhook_secret_ref
    ? await secretStore.getSecret(connection.luma_webhook_secret_ref)
    : null;
  const webhooks = await listAllLumaWebhooks(lumaApiKey);
  let matchedWebhook =
    webhooks.find((webhook) => webhook.id === connection.luma_webhook_id) ||
    webhooks.find((webhook) => webhook.url === callbackUrl) ||
    null;

  const desiredEventTypes = [...LUMA_MANAGED_EVENT_WEBHOOK_TYPES];
  const needsRecreate =
    Boolean(matchedWebhook) &&
    (matchedWebhook?.url !== callbackUrl || !existingSecret);

  if (matchedWebhook && needsRecreate) {
    await deleteLumaWebhook({
      apiKey: lumaApiKey,
      id: matchedWebhook.id,
    });
    matchedWebhook = null;
  }

  let webhookId = connection.luma_webhook_id;
  let webhookSecretRef = connection.luma_webhook_secret_ref;

  if (!matchedWebhook) {
    const createdWebhook = await createLumaWebhook({
      apiKey: lumaApiKey,
      url: callbackUrl,
      eventTypes: desiredEventTypes,
    });
    if (!createdWebhook.secret) {
      throw new Error("Luma did not return a webhook signing secret.");
    }

    webhookId = createdWebhook.id;
    webhookSecretRef = await secretStore.setSecret(
      connection.luma_webhook_secret_ref,
      createdWebhook.secret,
    );
  } else {
    if (
      matchedWebhook.status !== "active" ||
      !eventTypesMatch(matchedWebhook.event_types, desiredEventTypes)
    ) {
      await updateLumaWebhook({
        apiKey: lumaApiKey,
        id: matchedWebhook.id,
        eventTypes: desiredEventTypes,
        status: "active",
      });
    }

    webhookId = matchedWebhook.id;
    if (matchedWebhook.secret) {
      webhookSecretRef = await secretStore.setSecret(
        connection.luma_webhook_secret_ref,
        matchedWebhook.secret,
      );
    }
  }

  const nextConnection = {
    ...connection,
    luma_webhook_id: webhookId || null,
    luma_webhook_secret_ref: webhookSecretRef || null,
    updated_at: nowIso(),
  };
  await putCalendarConnection(nextConnection);

  return {
    connection: nextConnection,
    callback_url: callbackUrl,
    event_types: desiredEventTypes,
  };
}

export async function syncCalendarConnection(calendarConnectionId: string) {
  const connection = await getCalendarConnection(calendarConnectionId);
  if (!connection) {
    throw new Error(`Calendar connection ${calendarConnectionId} was not found.`);
  }

  const lumaApiKey = await getSecretStore().getSecret(
    requireLumaApiSecretRef(connection.luma_api_secret_ref),
  );
  if (!lumaApiKey) {
    throw new Error("Luma API secret could not be resolved from the secret store.");
  }

  const timestamp = nowIso();
  try {
    const events = await listLumaEvents(lumaApiKey);
    const existingEvents = await listEventMirrorsByCalendar(connection.calendar_connection_id);
    const existingByEventId = new Map(
      existingEvents.map((event) => [event.event_api_id, event]),
    );
    const seenEventIds = new Set<string>();
    const syncedEvents: EventMirror[] = [];

    for (const event of events) {
      seenEventIds.add(event.api_id);
      const existing = existingByEventId.get(event.api_id) || null;
      const tickets = await syncTicketMirrorsForEvent({
        tenant_id: connection.tenant_id,
        calendar_connection_id: connection.calendar_connection_id,
        event_api_id: event.api_id,
        luma_api_key: lumaApiKey,
      });
      const zcashEnabled = tickets.some((ticket) => ticket.zcash_enabled);
      const nextEvent: EventMirror = {
        event_mirror_id:
          existing?.event_mirror_id || `${connection.calendar_connection_id}:${event.api_id}`,
        tenant_id: connection.tenant_id,
        calendar_connection_id: connection.calendar_connection_id,
        event_api_id: event.api_id,
        name: event.name,
        start_at: event.start_at,
        end_at: event.end_at,
        timezone: event.timezone,
        description: event.description,
        cover_url: event.cover_url,
        url: event.url,
        location_label: event.location_label,
        location_note: event.location_note,
        sync_status: "active",
        zcash_enabled: zcashEnabled,
        zcash_enabled_reason: zcashEnabled
          ? "At least one ticket is enabled for Zcash checkout."
          : "No tickets are currently enabled for managed Zcash checkout.",
        last_synced_at: timestamp,
        last_sync_hash: safeJsonHash({
          event,
          tickets: tickets.map((ticket) => ({
            id: ticket.ticket_type_api_id,
            updated_at: ticket.updated_at,
            enabled: ticket.zcash_enabled,
          })),
        }),
        created_at: existing?.created_at || timestamp,
        updated_at: timestamp,
      };
      syncedEvents.push(await putEventMirror(nextEvent));
    }

    for (const existing of existingEvents) {
      if (seenEventIds.has(existing.event_api_id)) {
        continue;
      }

      syncedEvents.push(
        await putEventMirror({
          ...existing,
          sync_status: "hidden",
          zcash_enabled: false,
          zcash_enabled_reason: "Event no longer appears in the latest Luma sync.",
          last_synced_at: timestamp,
          updated_at: timestamp,
        }),
      );
    }

    const nextConnection = {
      ...connection,
      status: "active" as const,
      last_validated_at: connection.last_validated_at || timestamp,
      last_synced_at: timestamp,
      last_sync_error: null,
      updated_at: timestamp,
    };
    await putCalendarConnection(nextConnection);

    logEvent("info", "calendar.sync.succeeded", {
      calendar_connection_id: connection.calendar_connection_id,
      tenant_id: connection.tenant_id,
      event_count: syncedEvents.length,
    });

    return {
      connection: nextConnection,
      events: syncedEvents,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar sync failed";
    await putCalendarConnection({
      ...connection,
      status: "sync_error",
      last_sync_error: message,
      updated_at: timestamp,
    });
    logEvent("error", "calendar.sync.failed", {
      calendar_connection_id: connection.calendar_connection_id,
      tenant_id: connection.tenant_id,
      error: message,
    });
    throw error;
  }
}

export async function handleCalendarRefreshWebhook(calendarConnectionId: string) {
  const result = await syncCalendarConnection(calendarConnectionId);
  return {
    refreshed_at: nowIso(),
    event_count: result.events.length,
  };
}
