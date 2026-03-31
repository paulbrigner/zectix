"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { asBoolean, asString } from "@/lib/app-state/utils";
import {
  getCalendarConnection,
  getCipherPayConnection,
  getTenantBySlug,
  putAdminAuditEvent,
} from "@/lib/app-state/state";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import {
  parseSupportRequestSubmission,
  sendSupportRequestEmail,
} from "@/lib/support-request";
import { buildOnboardingChecklist } from "@/lib/tenant-self-serve";
import {
  getTenantSelfServeDetailBySlug,
  createCalendarConnection,
  createCipherPayConnection,
  disableCalendarConnection,
  listSelfServeTenantsForEmail,
  setTenantStatus,
  setEventPublicCheckoutRequested,
  setTicketOperatorAssertions,
  syncCalendarEventForOps,
  updateCalendarConnectionLumaKey,
  updateCalendarEmbedSettings,
  validateAndSyncCalendar,
  validateCipherPayConnection,
} from "@/lib/tenancy/service";

type TenantSelfServeDetail = NonNullable<
  Awaited<ReturnType<typeof getTenantSelfServeDetailBySlug>>
>;

function redirectTo(formData: FormData, fallback: string) {
  const next = asString(formData.get("redirect_to"));
  redirect(next || fallback);
}

function redirectToWithQuery(base: string, params: URLSearchParams) {
  const query = params.toString();
  if (!query) {
    redirect(base);
  }

  const [baseWithoutHash, hash = ""] = base.split("#", 2);
  const nextUrl =
    `${baseWithoutHash}${baseWithoutHash.includes("?") ? "&" : "?"}${query}` +
    (hash ? `#${hash}` : "");
  redirect(nextUrl);
}

async function requireTenantMutationContext(tenantSlug: string) {
  const sessionEmail = await requireTenantPageAccess();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant || tenant.contact_email.trim().toLowerCase() !== sessionEmail) {
    redirect("/dashboard");
  }

  const detail = await getTenantSelfServeDetailBySlug(tenant.slug, sessionEmail);
  return {
    detail,
    sessionEmail,
    tenant,
  };
}

async function requireCalendarTenantAccess(tenantId: string, calendarConnectionId: string) {
  const connection = await getCalendarConnection(calendarConnectionId);
  if (!connection || connection.tenant_id !== tenantId) {
    redirect("/dashboard");
  }

  return connection;
}

async function requireCipherPayTenantAccess(tenantId: string, cipherpayConnectionId: string) {
  const connection = await getCipherPayConnection(cipherpayConnectionId);
  if (!connection || connection.tenant_id !== tenantId) {
    redirect("/dashboard");
  }

  return connection;
}

function onboardingChecklistComplete(
  detail: Awaited<ReturnType<typeof getTenantSelfServeDetailBySlug>> | null,
) {
  return detail ? buildOnboardingChecklist(detail).every((item) => item.complete) : false;
}

function summarizeTenantDashboardMutation(
  detail: TenantSelfServeDetail | null,
) {
  if (!detail) {
    return null;
  }

  const checklist = buildOnboardingChecklist(detail);
  const publicEvents = detail.events.flatMap(({ events }) =>
    events.filter((event) => event.zcash_enabled),
  );
  const publicTickets = Array.from(detail.tickets_by_event.values())
    .flat()
    .filter((ticket) => ticket.zcash_enabled);

  return {
    active_calendar_count: detail.calendars.filter(
      (calendar) => calendar.status === "active",
    ).length,
    active_cipherpay_connection_count: detail.cipherpay_connections.filter(
      (connection) => connection.status === "active",
    ).length,
    calendar_count: detail.calendars.length,
    checklist_complete: checklist.every((item) => item.complete),
    checklist_completed_steps: checklist.filter((item) => item.complete).length,
    checklist_total_steps: checklist.length,
    cipherpay_connection_count: detail.cipherpay_connections.length,
    embed_enabled_calendar_count: detail.calendars.filter(
      (calendar) => calendar.embed_enabled,
    ).length,
    onboarding_status: detail.tenant.onboarding_status,
    public_event_count: publicEvents.length,
    public_ticket_count: publicTickets.length,
    tenant_status: detail.tenant.status,
  };
}

async function auditTenantDashboardAction(input: {
  action: string;
  beforeDetail: TenantSelfServeDetail | null;
  context?: Record<string, unknown>;
  sessionEmail: string;
  tenantId: string;
  tenantSlug: string;
}) {
  const afterDetail = await getTenantSelfServeDetailBySlug(
    input.tenantSlug,
    input.sessionEmail,
  );

  await putAdminAuditEvent({
    event_type: `tenant.dashboard.${input.action}`,
    actor_ip: null,
    actor_origin: null,
    request_headers_json: null,
    metadata_json: {
      action: input.action,
      actor_email: input.sessionEmail,
      after_summary: summarizeTenantDashboardMutation(afterDetail),
      before_summary: summarizeTenantDashboardMutation(input.beforeDetail),
      tenant_id: input.tenantId,
      ...input.context,
    },
  });
}

function resolvePublicEventNotice(
  detail: NonNullable<Awaited<ReturnType<typeof getTenantSelfServeDetailBySlug>>>,
  preferredEventApiId?: string | null,
) {
  const liveEvents = detail.events.flatMap(({ calendar, events }) =>
    events
      .filter((event) => event.zcash_enabled)
      .map((event) => ({
        href: `/c/${calendar.slug}/events/${encodeURIComponent(event.event_api_id)}`,
        isPreferred: preferredEventApiId
          ? event.event_api_id === preferredEventApiId
          : false,
        name: event.name,
      })),
  );

  if (!liveEvents.length) {
    return null;
  }

  return liveEvents.find((event) => event.isPreferred) || liveEvents[0];
}

async function appendOnboardingCompletionNotice(params: URLSearchParams, input: {
  eventApiId?: string | null;
  sessionEmail: string;
  tenantSlug: string;
  wasComplete: boolean;
}) {
  const nextDetail = await getTenantSelfServeDetailBySlug(
    input.tenantSlug,
    input.sessionEmail,
  );
  if (!nextDetail) {
    return;
  }

  if (input.wasComplete || !onboardingChecklistComplete(nextDetail)) {
    return;
  }

  params.set("onboarding_complete", "1");
  const publicEvent = resolvePublicEventNotice(nextDetail, input.eventApiId);
  if (publicEvent) {
    params.set("onboarding_event_href", publicEvent.href);
    params.set("onboarding_event_name", publicEvent.name);
  }
}

export async function createCalendarConnectionAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const { detail: beforeDetail, sessionEmail, tenant } =
    await requireTenantMutationContext(tenantSlug);
  const displayName = String(formData.get("display_name") || "");
  const slug = asString(formData.get("slug"));
  await createCalendarConnection({
    tenant_id: tenant.tenant_id,
    display_name: displayName,
    slug,
    luma_api_key: String(formData.get("luma_api_key") || ""),
  });
  await auditTenantDashboardAction({
    action: "create_calendar_connection",
    beforeDetail,
    context: {
      calendar_display_name: displayName,
      calendar_slug: slug,
    },
    sessionEmail,
    tenantId: tenant.tenant_id,
    tenantSlug: tenant.slug,
  });

  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/connections`);
}

export async function validateAndSyncCalendarAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const { detail: beforeDetail, sessionEmail, tenant } =
    await requireTenantMutationContext(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  await validateAndSyncCalendar(calendarConnectionId);
  await auditTenantDashboardAction({
    action: "validate_and_sync_calendar",
    beforeDetail,
    context: {
      calendar_connection_id: calendarConnectionId,
    },
    sessionEmail,
    tenantId: tenant.tenant_id,
    tenantSlug: tenant.slug,
  });
  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/connections`);
}

export async function syncCalendarEventAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const { detail: beforeDetail, sessionEmail, tenant } =
    await requireTenantMutationContext(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  const redirectBase =
    asString(formData.get("redirect_to")) || `/dashboard/${encodeURIComponent(tenant.slug)}/events`;

  try {
    const result = await syncCalendarEventForOps({
      calendar_connection_id: calendarConnectionId,
      event_api_id: String(formData.get("event_api_id") || ""),
      event_name: String(formData.get("event_name") || ""),
      focus: formData.get("focus") === "upstream" ? "upstream" : "mirrored",
    });

    const params = new URLSearchParams();
    params.set("sync_event_id", result.review.event_api_id);
    params.set("sync_event_name", result.review.event_name);
    params.set("sync_focus", result.review.focus);
    params.set("sync_outcome", result.review.outcome);
    params.set("sync_status", result.review.sync_status);
    params.set("sync_added", String(result.review.tickets_added));
    params.set("sync_removed", String(result.review.tickets_removed));
    params.set("sync_mirrored", String(result.review.mirrored_ticket_count));
    params.set("sync_enabled", String(result.review.enabled_ticket_count));
    params.set("sync_public", result.review.public_checkout_enabled ? "1" : "0");
    params.set("sync_at", result.review.happened_at);
    await auditTenantDashboardAction({
      action: "sync_calendar_event",
      beforeDetail,
      context: {
        calendar_connection_id: calendarConnectionId,
        event_api_id: result.review.event_api_id,
        focus: result.review.focus,
        sync_outcome: result.review.outcome,
      },
      sessionEmail,
      tenantId: tenant.tenant_id,
      tenantSlug: tenant.slug,
    });
    redirectToWithQuery(redirectBase, params);
  } catch (error) {
    unstable_rethrow(error);

    const params = new URLSearchParams();
    params.set(
      "sync_error",
      error instanceof Error ? error.message : "Could not refresh this Luma event.",
    );
    params.set("sync_event_id", String(formData.get("event_api_id") || ""));
    params.set("sync_event_name", String(formData.get("event_name") || ""));
    params.set("sync_focus", formData.get("focus") === "upstream" ? "upstream" : "mirrored");
    redirectToWithQuery(redirectBase, params);
  }
}

export async function updateCalendarConnectionLumaKeyAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const { detail: beforeDetail, sessionEmail, tenant } =
    await requireTenantMutationContext(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  await updateCalendarConnectionLumaKey(
    calendarConnectionId,
    String(formData.get("luma_api_key") || ""),
  );
  await auditTenantDashboardAction({
    action: "update_calendar_luma_key",
    beforeDetail,
    context: {
      calendar_connection_id: calendarConnectionId,
    },
    sessionEmail,
    tenantId: tenant.tenant_id,
    tenantSlug: tenant.slug,
  });
  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/connections`);
}

export async function disableCalendarConnectionAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const { detail: beforeDetail, sessionEmail, tenant } =
    await requireTenantMutationContext(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  await disableCalendarConnection(calendarConnectionId);
  await auditTenantDashboardAction({
    action: "disable_calendar_connection",
    beforeDetail,
    context: {
      calendar_connection_id: calendarConnectionId,
    },
    sessionEmail,
    tenantId: tenant.tenant_id,
    tenantSlug: tenant.slug,
  });
  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/connections`);
}

export async function activatePublicCheckoutAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const { detail, sessionEmail, tenant } =
    await requireTenantMutationContext(tenantSlug);
  if (!detail) {
    redirect("/dashboard");
  }

  const onboardingChecklist = buildOnboardingChecklist(detail);
  const activationStepIndex = onboardingChecklist.findIndex(
    (item) => item.stepId === "activate_public_checkout",
  );
  const prerequisitesReady = onboardingChecklist
    .slice(0, activationStepIndex)
    .every((item) => item.complete);

  if (prerequisitesReady && detail.tenant.status !== "active") {
    await setTenantStatus(tenant.tenant_id, "active");
  }
  await auditTenantDashboardAction({
    action: "activate_public_checkout",
    beforeDetail: detail,
    context: {
      prerequisites_ready: prerequisitesReady,
    },
    sessionEmail,
    tenantId: tenant.tenant_id,
    tenantSlug: tenant.slug,
  });

  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/connections`);
}

export async function createCipherPayConnectionAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const { detail: beforeDetail, sessionEmail, tenant } =
    await requireTenantMutationContext(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  const network = formData.get("network") === "mainnet" ? "mainnet" : "testnet";
  const connection = await createCipherPayConnection({
    tenant_id: tenant.tenant_id,
    calendar_connection_id: calendarConnectionId,
    network,
    api_base_url: asString(formData.get("api_base_url")),
    checkout_base_url: asString(formData.get("checkout_base_url")),
    cipherpay_api_key: String(formData.get("cipherpay_api_key") || ""),
    cipherpay_webhook_secret: String(formData.get("cipherpay_webhook_secret") || ""),
  });
  await validateCipherPayConnection(connection.cipherpay_connection_id);
  await auditTenantDashboardAction({
    action: "create_cipherpay_connection",
    beforeDetail,
    context: {
      calendar_connection_id: calendarConnectionId,
      cipherpay_connection_id: connection.cipherpay_connection_id,
      network,
    },
    sessionEmail,
    tenantId: tenant.tenant_id,
    tenantSlug: tenant.slug,
  });

  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/connections`);
}

export async function validateCipherPayConnectionAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const { detail: beforeDetail, sessionEmail, tenant } =
    await requireTenantMutationContext(tenantSlug);
  const cipherpayConnectionId = String(formData.get("cipherpay_connection_id") || "");
  await requireCipherPayTenantAccess(tenant.tenant_id, cipherpayConnectionId);
  await validateCipherPayConnection(cipherpayConnectionId);
  await auditTenantDashboardAction({
    action: "validate_cipherpay_connection",
    beforeDetail,
    context: {
      cipherpay_connection_id: cipherpayConnectionId,
    },
    sessionEmail,
    tenantId: tenant.tenant_id,
    tenantSlug: tenant.slug,
  });
  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/connections`);
}

export async function updateCalendarEmbedSettingsAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const { detail: beforeDetail, sessionEmail, tenant } =
    await requireTenantMutationContext(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  const embedEnabled = asBoolean(formData.get("embed_enabled"));
  const embedShowBranding = asBoolean(formData.get("embed_show_branding"));
  await updateCalendarEmbedSettings({
    calendar_connection_id: calendarConnectionId,
    embed_enabled: embedEnabled,
    embed_allowed_origins: String(formData.get("embed_allowed_origins") || ""),
    embed_default_height_px: asString(formData.get("embed_default_height_px")),
    embed_show_branding: embedShowBranding,
    embed_theme: {
      accent_color: asString(formData.get("embed_accent_color")),
      background_color: asString(formData.get("embed_background_color")),
      surface_color: asString(formData.get("embed_surface_color")),
      text_color: asString(formData.get("embed_text_color")),
      radius_px: asString(formData.get("embed_radius_px")),
    },
  });
  await auditTenantDashboardAction({
    action: "update_calendar_embed_settings",
    beforeDetail,
    context: {
      calendar_connection_id: calendarConnectionId,
      embed_enabled: embedEnabled,
      embed_show_branding: embedShowBranding,
    },
    sessionEmail,
    tenantId: tenant.tenant_id,
    tenantSlug: tenant.slug,
  });
  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/embed`);
}

export async function submitSupportRequestAction(formData: FormData) {
  const sessionEmail = await requireTenantPageAccess();
  const redirectBase = asString(formData.get("redirect_to")) || "/dashboard/help";
  const params = new URLSearchParams();
  const allowedTenants = await listSelfServeTenantsForEmail(sessionEmail);
  const requestedTenantSlug = asString(formData.get("tenant_slug"));
  const requestedTenant =
    requestedTenantSlug
      ? allowedTenants.find((tenant) => tenant.slug === requestedTenantSlug) || null
      : null;

  const parsed = parseSupportRequestSubmission({
    email: sessionEmail,
    organization: requestedTenant?.name || null,
    subject: String(formData.get("subject") || ""),
    message: String(formData.get("message") || ""),
    contextPath: asString(formData.get("context_path")),
  });

  if (!parsed.ok) {
    params.set("error", parsed.error);
    redirectToWithQuery(redirectBase, params);
    return;
  }

  try {
    await sendSupportRequestEmail(parsed.data);
  } catch (error) {
    console.error("Failed to send organizer support request.", error);
    params.set(
      "error",
      "We couldn't send your support request right now. Please try again in a moment.",
    );
    redirectToWithQuery(redirectBase, params);
  }

  params.set("sent", "1");
  redirectToWithQuery(redirectBase, params);
}

export async function setTicketAssertionsAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const { detail: beforeDetail, sessionEmail, tenant } =
    await requireTenantMutationContext(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  const redirectBase =
    asString(formData.get("redirect_to")) || `/dashboard/${encodeURIComponent(tenant.slug)}/events`;
  const wasComplete = onboardingChecklistComplete(beforeDetail);
  const eventApiId = String(formData.get("event_api_id") || "");
  const ticketTypeApiId = String(formData.get("ticket_type_api_id") || "");
  const publicCheckoutRequested =
    formData.get("public_checkout_requested_present") != null
      ? asBoolean(formData.get("public_checkout_requested"))
      : undefined;
  await setTicketOperatorAssertions({
    event_api_id: eventApiId,
    ticket_type_api_id: ticketTypeApiId,
    confirmed_fixed_price: true,
    confirmed_no_approval_required: true,
    confirmed_no_extra_required_questions: true,
    public_checkout_requested: publicCheckoutRequested,
  });
  const params = new URLSearchParams();
  await appendOnboardingCompletionNotice(params, {
    eventApiId,
    sessionEmail,
    tenantSlug: tenant.slug,
    wasComplete,
  });
  await auditTenantDashboardAction({
    action: "set_ticket_assertions",
    beforeDetail,
    context: {
      calendar_connection_id: calendarConnectionId,
      event_api_id: eventApiId,
      public_checkout_requested: publicCheckoutRequested,
      ticket_type_api_id: ticketTypeApiId,
    },
    sessionEmail,
    tenantId: tenant.tenant_id,
    tenantSlug: tenant.slug,
  });
  redirectToWithQuery(redirectBase, params);
}

export async function setEventPublicCheckoutAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const { detail: beforeDetail, sessionEmail, tenant } =
    await requireTenantMutationContext(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  const redirectBase =
    asString(formData.get("redirect_to")) || `/dashboard/${encodeURIComponent(tenant.slug)}/events`;
  const wasComplete = onboardingChecklistComplete(beforeDetail);
  const eventApiId = String(formData.get("event_api_id") || "");
  const publicCheckoutRequested = asBoolean(formData.get("public_checkout_requested"));
  await setEventPublicCheckoutRequested({
    calendar_connection_id: calendarConnectionId,
    event_api_id: eventApiId,
    public_checkout_requested: publicCheckoutRequested,
  });
  const params = new URLSearchParams();
  await appendOnboardingCompletionNotice(params, {
    eventApiId,
    sessionEmail,
    tenantSlug: tenant.slug,
    wasComplete,
  });
  await auditTenantDashboardAction({
    action: "set_event_public_checkout",
    beforeDetail,
    context: {
      calendar_connection_id: calendarConnectionId,
      event_api_id: eventApiId,
      public_checkout_requested: publicCheckoutRequested,
    },
    sessionEmail,
    tenantId: tenant.tenant_id,
    tenantSlug: tenant.slug,
  });
  redirectToWithQuery(redirectBase, params);
}
