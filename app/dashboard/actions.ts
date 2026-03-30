"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { asBoolean, asString } from "@/lib/app-state/utils";
import {
  getCalendarConnection,
  getCipherPayConnection,
  getTenantBySlug,
} from "@/lib/app-state/state";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import {
  parseSupportRequestSubmission,
  sendSupportRequestEmail,
} from "@/lib/support-request";
import {
  createCalendarConnection,
  createCipherPayConnection,
  disableCalendarConnection,
  listSelfServeTenantsForEmail,
  setEventPublicCheckoutRequested,
  setTicketOperatorAssertions,
  syncCalendarEventForOps,
  updateCalendarConnectionLumaKey,
  updateCalendarEmbedSettings,
  validateAndSyncCalendar,
  validateCipherPayConnection,
} from "@/lib/tenancy/service";

function redirectTo(formData: FormData, fallback: string) {
  const next = asString(formData.get("redirect_to"));
  redirect(next || fallback);
}

function redirectToWithQuery(base: string, params: URLSearchParams) {
  const query = params.toString();
  if (!query) {
    redirect(base);
  }

  redirect(`${base}${base.includes("?") ? "&" : "?"}${query}`);
}

async function requireTenantSlugAccess(tenantSlug: string) {
  const sessionEmail = await requireTenantPageAccess();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant || tenant.contact_email.trim().toLowerCase() !== sessionEmail) {
    redirect("/dashboard");
  }

  return tenant;
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

export async function createCalendarConnectionAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const tenant = await requireTenantSlugAccess(tenantSlug);
  await createCalendarConnection({
    tenant_id: tenant.tenant_id,
    display_name: String(formData.get("display_name") || ""),
    slug: asString(formData.get("slug")),
    luma_api_key: String(formData.get("luma_api_key") || ""),
  });

  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/connections`);
}

export async function validateAndSyncCalendarAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const tenant = await requireTenantSlugAccess(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  await validateAndSyncCalendar(calendarConnectionId);
  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/connections`);
}

export async function syncCalendarEventAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const tenant = await requireTenantSlugAccess(tenantSlug);
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
  const tenant = await requireTenantSlugAccess(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  await updateCalendarConnectionLumaKey(
    calendarConnectionId,
    String(formData.get("luma_api_key") || ""),
  );
  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/connections`);
}

export async function disableCalendarConnectionAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const tenant = await requireTenantSlugAccess(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  await disableCalendarConnection(calendarConnectionId);
  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/connections`);
}

export async function createCipherPayConnectionAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const tenant = await requireTenantSlugAccess(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  await createCipherPayConnection({
    tenant_id: tenant.tenant_id,
    calendar_connection_id: calendarConnectionId,
    network: formData.get("network") === "mainnet" ? "mainnet" : "testnet",
    api_base_url: asString(formData.get("api_base_url")),
    checkout_base_url: asString(formData.get("checkout_base_url")),
    cipherpay_api_key: String(formData.get("cipherpay_api_key") || ""),
    cipherpay_webhook_secret: String(formData.get("cipherpay_webhook_secret") || ""),
  });

  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/connections`);
}

export async function validateCipherPayConnectionAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const tenant = await requireTenantSlugAccess(tenantSlug);
  const cipherpayConnectionId = String(formData.get("cipherpay_connection_id") || "");
  await requireCipherPayTenantAccess(tenant.tenant_id, cipherpayConnectionId);
  await validateCipherPayConnection(cipherpayConnectionId);
  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/connections`);
}

export async function updateCalendarEmbedSettingsAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const tenant = await requireTenantSlugAccess(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  await updateCalendarEmbedSettings({
    calendar_connection_id: calendarConnectionId,
    embed_enabled: asBoolean(formData.get("embed_enabled")),
    embed_allowed_origins: String(formData.get("embed_allowed_origins") || ""),
    embed_default_height_px: asString(formData.get("embed_default_height_px")),
    embed_show_branding: asBoolean(formData.get("embed_show_branding")),
    embed_theme: {
      accent_color: asString(formData.get("embed_accent_color")),
      background_color: asString(formData.get("embed_background_color")),
      surface_color: asString(formData.get("embed_surface_color")),
      text_color: asString(formData.get("embed_text_color")),
      radius_px: asString(formData.get("embed_radius_px")),
    },
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
  const tenant = await requireTenantSlugAccess(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  await setTicketOperatorAssertions({
    event_api_id: String(formData.get("event_api_id") || ""),
    ticket_type_api_id: String(formData.get("ticket_type_api_id") || ""),
    confirmed_fixed_price: asBoolean(formData.get("confirmed_fixed_price")),
    confirmed_no_approval_required: asBoolean(
      formData.get("confirmed_no_approval_required"),
    ),
    confirmed_no_extra_required_questions: asBoolean(
      formData.get("confirmed_no_extra_required_questions"),
    ),
    public_checkout_requested:
      formData.get("public_checkout_requested_present") != null
        ? asBoolean(formData.get("public_checkout_requested"))
        : undefined,
  });
  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/events`);
}

export async function setEventPublicCheckoutAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") || "");
  const tenant = await requireTenantSlugAccess(tenantSlug);
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
  await setEventPublicCheckoutRequested({
    calendar_connection_id: calendarConnectionId,
    event_api_id: String(formData.get("event_api_id") || ""),
    public_checkout_requested: asBoolean(formData.get("public_checkout_requested")),
  });
  redirectTo(formData, `/dashboard/${encodeURIComponent(tenant.slug)}/events`);
}
