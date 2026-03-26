"use server";

import { redirect } from "next/navigation";
import { asBoolean, asNonNegativeInteger, asString } from "@/lib/app-state/utils";
import { retryRegistrationForSession, retryDueRegistrations } from "@/lib/app-state/service";
import { requireOpsPageAccess } from "@/lib/admin-auth-server";
import {
  createCalendarConnection,
  createCipherPayConnection,
  createTenant,
  setTicketOperatorAssertions,
  validateAndSyncCalendar,
  validateCipherPayConnection,
} from "@/lib/tenancy/service";

function redirectTo(formData: FormData, fallback: string) {
  const next = asString(formData.get("redirect_to"));
  redirect(next || fallback);
}

export async function createTenantAction(formData: FormData) {
  await requireOpsPageAccess();
  const tenant = await createTenant({
    name: String(formData.get("name") || ""),
    slug: asString(formData.get("slug")),
    contact_email: String(formData.get("contact_email") || ""),
    monthly_minimum_usd_cents: asNonNegativeInteger(
      formData.get("monthly_minimum_usd_cents"),
      0,
    ),
    service_fee_bps: asNonNegativeInteger(formData.get("service_fee_bps"), 0),
    pilot_notes: asString(formData.get("pilot_notes")),
  });

  redirect(`/ops/tenants/${encodeURIComponent(tenant.tenant_id)}`);
}

export async function createCalendarConnectionAction(formData: FormData) {
  await requireOpsPageAccess();
  const connection = await createCalendarConnection({
    tenant_id: String(formData.get("tenant_id") || ""),
    display_name: String(formData.get("display_name") || ""),
    slug: asString(formData.get("slug")),
    luma_api_key: String(formData.get("luma_api_key") || ""),
    luma_webhook_secret: asString(formData.get("luma_webhook_secret")),
    luma_webhook_id: asString(formData.get("luma_webhook_id")),
  });

  redirectTo(formData, `/ops/tenants/${encodeURIComponent(connection.tenant_id)}`);
}

export async function validateAndSyncCalendarAction(formData: FormData) {
  await requireOpsPageAccess();
  const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
  const connection = await validateAndSyncCalendar(calendarConnectionId);
  redirectTo(formData, `/ops/tenants/${encodeURIComponent(connection.connection.tenant_id)}`);
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
