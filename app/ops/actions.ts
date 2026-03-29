"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { asBoolean, asNonNegativeInteger, asString } from "@/lib/app-state/utils";
import {
  createBillingAdjustment,
  updateBillingCycleState,
} from "@/lib/billing/usage-ledger";
import { retryRegistrationForSession, retryDueRegistrations } from "@/lib/app-state/service";
import { requireOpsPageAccess } from "@/lib/admin-auth-server";
import type {
  BillingCycleStatus,
  TenantBillingStatus,
  TenantStatus,
} from "@/lib/app-state/types";
import {
  createCalendarConnection,
  createCipherPayConnection,
  createTenant,
  disableCalendarConnection,
  setTenantStatus,
  setTicketOperatorAssertions,
  syncCalendarEventForOps,
  updateTenantBillingSettings,
  updateCalendarConnectionLumaKey,
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

function asTenantStatus(value: unknown, fallback: TenantStatus = "draft"): TenantStatus {
  return value === "active" ||
    value === "suspended" ||
    value === "archived" ||
    value === "draft"
    ? value
    : fallback;
}

function asTenantBillingStatus(
  value: unknown,
  fallback: TenantBillingStatus = "active",
): TenantBillingStatus {
  return value === "past_due" || value === "suspended" || value === "active"
    ? value
    : fallback;
}

function asBillingCycleStatus(
  value: unknown,
  fallback: BillingCycleStatus = "open",
): BillingCycleStatus {
  return value === "invoiced" ||
    value === "paid" ||
    value === "past_due" ||
    value === "suspended" ||
    value === "carried_over" ||
    value === "open"
    ? value
    : fallback;
}

export async function createTenantAction(formData: FormData) {
  await requireOpsPageAccess();
  const serviceFeeBpsValue = asString(formData.get("service_fee_bps"));
  const settlementThresholdValue = asString(
    formData.get("settlement_threshold_zatoshis"),
  );
  const tenant = await createTenant({
    name: String(formData.get("name") || ""),
    slug: asString(formData.get("slug")),
    contact_email: String(formData.get("contact_email") || ""),
    service_fee_bps:
      serviceFeeBpsValue == null
        ? undefined
        : asNonNegativeInteger(serviceFeeBpsValue, 0),
    billing_status: asTenantBillingStatus(formData.get("billing_status"), "active"),
    billing_grace_days: asNonNegativeInteger(formData.get("billing_grace_days"), 7),
    settlement_threshold_zatoshis:
      settlementThresholdValue == null
        ? undefined
        : asNonNegativeInteger(settlementThresholdValue, 0),
    pilot_notes: asString(formData.get("pilot_notes")),
  });

  redirect(`/ops/tenants/${encodeURIComponent(tenant.tenant_id)}`);
}

export async function setTenantStatusAction(formData: FormData) {
  await requireOpsPageAccess();
  const tenantId = String(formData.get("tenant_id") || "");
  const status = asTenantStatus(formData.get("status"), "draft");
  await setTenantStatus(tenantId, status);
  redirectTo(formData, `/ops/tenants/${encodeURIComponent(tenantId)}`);
}

export async function updateTenantBillingSettingsAction(formData: FormData) {
  await requireOpsPageAccess();
  const tenantId = String(formData.get("tenant_id") || "");
  await updateTenantBillingSettings({
    tenant_id: tenantId,
    service_fee_bps: asNonNegativeInteger(formData.get("service_fee_bps"), 0),
    billing_status: asTenantBillingStatus(formData.get("billing_status"), "active"),
    billing_grace_days: asNonNegativeInteger(formData.get("billing_grace_days"), 7),
    settlement_threshold_zatoshis: asNonNegativeInteger(
      formData.get("settlement_threshold_zatoshis"),
      0,
    ),
  });
  redirectTo(formData, `/ops/tenants/${encodeURIComponent(tenantId)}`);
}

export async function updateBillingCycleStatusAction(formData: FormData) {
  await requireOpsPageAccess();
  const billingCycleId = String(formData.get("billing_cycle_id") || "");
  await updateBillingCycleState({
    billing_cycle_id: billingCycleId,
    status: asBillingCycleStatus(formData.get("status"), "open"),
    invoice_reference: asString(formData.get("invoice_reference")),
    settlement_txid: asString(formData.get("settlement_txid")),
  });
  redirectTo(formData, "/ops/reports");
}

export async function createBillingAdjustmentAction(formData: FormData) {
  await requireOpsPageAccess();
  const billingCycleId = String(formData.get("billing_cycle_id") || "");
  await createBillingAdjustment({
    billing_cycle_id: billingCycleId,
    type: formData.get("type") === "waiver" ? "waiver" : "credit",
    amount_zatoshis: asNonNegativeInteger(formData.get("amount_zatoshis"), 0),
    reason: String(formData.get("reason") || ""),
  });
  redirectTo(formData, "/ops/reports");
}

export async function createCalendarConnectionAction(formData: FormData) {
  await requireOpsPageAccess();
  const connection = await createCalendarConnection({
    tenant_id: String(formData.get("tenant_id") || ""),
    display_name: String(formData.get("display_name") || ""),
    slug: asString(formData.get("slug")),
    luma_api_key: String(formData.get("luma_api_key") || ""),
  });

  redirectTo(formData, `/ops/tenants/${encodeURIComponent(connection.tenant_id)}`);
}

export async function validateAndSyncCalendarAction(formData: FormData) {
  await requireOpsPageAccess();
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  const connection = await validateAndSyncCalendar(calendarConnectionId);
  redirectTo(formData, `/ops/tenants/${encodeURIComponent(connection.connection.tenant_id)}`);
}

export async function syncCalendarEventAction(formData: FormData) {
  await requireOpsPageAccess();
  const tenantId = String(formData.get("tenant_id") || "");
  const redirectBase =
    asString(formData.get("redirect_to")) ||
    `/ops/tenants/${encodeURIComponent(tenantId)}/events`;

  try {
    const result = await syncCalendarEventForOps({
      calendar_connection_id: String(formData.get("calendar_connection_id") || ""),
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
  await requireOpsPageAccess();
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  const connection = await updateCalendarConnectionLumaKey(
    calendarConnectionId,
    String(formData.get("luma_api_key") || ""),
  );
  redirectTo(formData, `/ops/tenants/${encodeURIComponent(connection.tenant_id)}`);
}

export async function disableCalendarConnectionAction(formData: FormData) {
  await requireOpsPageAccess();
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  const connection = await disableCalendarConnection(calendarConnectionId);
  redirectTo(formData, `/ops/tenants/${encodeURIComponent(connection.tenant_id)}`);
}

export async function createCipherPayConnectionAction(formData: FormData) {
  await requireOpsPageAccess();
  const connection = await createCipherPayConnection({
    tenant_id: String(formData.get("tenant_id") || ""),
    calendar_connection_id: String(formData.get("calendar_connection_id") || ""),
    network:
      formData.get("network") === "mainnet" ? "mainnet" : "testnet",
    api_base_url: asString(formData.get("api_base_url")),
    checkout_base_url: asString(formData.get("checkout_base_url")),
    cipherpay_api_key: String(formData.get("cipherpay_api_key") || ""),
    cipherpay_webhook_secret: String(
      formData.get("cipherpay_webhook_secret") || "",
    ),
  });

  redirectTo(formData, `/ops/tenants/${encodeURIComponent(connection.tenant_id)}`);
}

export async function validateCipherPayConnectionAction(formData: FormData) {
  await requireOpsPageAccess();
  const connection = await validateCipherPayConnection(
    String(formData.get("cipherpay_connection_id") || ""),
  );
  redirectTo(formData, `/ops/tenants/${encodeURIComponent(connection.tenant_id)}`);
}

export async function setTicketAssertionsAction(formData: FormData) {
  await requireOpsPageAccess();
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
  });
  redirectTo(formData, "/ops/tenants");
}

export async function retryRegistrationAction(formData: FormData) {
  await requireOpsPageAccess();
  await retryRegistrationForSession(String(formData.get("session_id") || ""));
  redirectTo(formData, "/ops");
}

export async function processDueTasksAction(formData: FormData) {
  await requireOpsPageAccess();
  await retryDueRegistrations(asNonNegativeInteger(formData.get("limit"), 10));
  redirectTo(formData, "/ops");
}
