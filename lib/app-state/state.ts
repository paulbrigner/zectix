import { createHash, randomUUID } from "node:crypto";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  appStateTableName,
  getDynamoDocumentClient,
} from "@/lib/app-state/dynamodb";
import type {
  AdminAuditEvent,
  BillingReportRow,
  CalendarConnection,
  CheckoutSession,
  CipherPayConnection,
  EventMirror,
  OpsDashboardData,
  RegistrationTask,
  Tenant,
  TenantListItem,
  TicketMirror,
  UsageLedgerEntry,
  WebhookDelivery,
} from "@/lib/app-state/types";
import {
  applyDerivedCheckoutSessionState,
  asBoolean,
  asFiniteNumber,
  asIsoTimestamp,
  asNonNegativeInteger,
  asRecord,
  asString,
  normalizeCurrencyCode,
  normalizeEmailAddress,
  nowIso,
  sortByIsoDateDesc,
} from "@/lib/app-state/utils";

function isMissingLocalStateError(error: unknown) {
  const candidate = error as { name?: string; message?: string } | null;
  const message = candidate?.message || "";

  return (
    candidate?.name === "ResourceNotFoundException" ||
    candidate?.name === "CredentialsProviderError" ||
    message.includes("Could not load credentials") ||
    message.includes("ECONNREFUSED") ||
    message.includes("connect ECONNREFUSED")
  );
}

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function sessionKey(sessionId: string) {
  return { pk: "SESSION", sk: sessionId };
}

function recentSessionKey(createdAt: string, sessionId: string) {
  return { pk: "SESSION_RECENT", sk: `${createdAt}#${sessionId}` };
}

function tenantSessionKey(tenantId: string, createdAt: string, sessionId: string) {
  return { pk: `TENANT_SESSIONS#${tenantId}`, sk: `${createdAt}#${sessionId}` };
}

function invoiceLookupKey(invoiceId: string) {
  return { pk: "INVOICE", sk: invoiceId };
}

function attendeeLookupKey(
  tenantId: string,
  calendarConnectionId: string,
  eventApiId: string,
  ticketTypeApiId: string,
  attendeeEmail: string,
  createdAt: string,
  sessionId: string,
) {
  return {
    pk:
      `SESSION_LOOKUP#${tenantId}#${calendarConnectionId}#${eventApiId}` +
      `#${ticketTypeApiId}#${normalizeEmailAddress(attendeeEmail)}`,
    sk: `${createdAt}#${sessionId}`,
  };
}

function tenantKey(tenantId: string) {
  return { pk: "TENANT", sk: tenantId };
}

function tenantSlugKey(slug: string) {
  return { pk: "TENANT_SLUG", sk: slug };
}

function calendarConnectionKey(calendarConnectionId: string) {
  return { pk: "CALENDAR_CONNECTION", sk: calendarConnectionId };
}

function tenantCalendarKey(
  tenantId: string,
  createdAt: string,
  calendarConnectionId: string,
) {
  return {
    pk: `TENANT_CALENDARS#${tenantId}`,
    sk: `${createdAt}#${calendarConnectionId}`,
  };
}

function calendarSlugKey(slug: string) {
  return { pk: "CALENDAR_SLUG", sk: slug };
}

function cipherPayConnectionKey(cipherpayConnectionId: string) {
  return { pk: "CIPHERPAY_CONNECTION", sk: cipherpayConnectionId };
}

function tenantCipherPayKey(
  tenantId: string,
  createdAt: string,
  cipherpayConnectionId: string,
) {
  return {
    pk: `TENANT_CIPHERPAY#${tenantId}`,
    sk: `${createdAt}#${cipherpayConnectionId}`,
  };
}

function calendarCipherPayKey(calendarConnectionId: string) {
  return { pk: "CALENDAR_CIPHERPAY", sk: calendarConnectionId };
}

function eventMirrorKey(calendarConnectionId: string, eventApiId: string) {
  return { pk: `EVENT#${calendarConnectionId}`, sk: eventApiId };
}

function ticketMirrorKey(eventApiId: string, ticketTypeApiId: string) {
  return { pk: `TICKET#${eventApiId}`, sk: ticketTypeApiId };
}

function webhookKey(receivedAt: string, webhookDeliveryId: string) {
  return { pk: "WEBHOOK", sk: `${receivedAt}#${webhookDeliveryId}` };
}

function tenantWebhookKey(
  tenantId: string,
  receivedAt: string,
  webhookDeliveryId: string,
) {
  return {
    pk: `TENANT_WEBHOOKS#${tenantId}`,
    sk: `${receivedAt}#${webhookDeliveryId}`,
  };
}

function taskKey(taskId: string) {
  return { pk: "REGISTRATION_TASK", sk: taskId };
}

function recentTaskKey(createdAt: string, taskId: string) {
  return { pk: "REGISTRATION_TASK_RECENT", sk: `${createdAt}#${taskId}` };
}

function tenantTaskKey(tenantId: string, createdAt: string, taskId: string) {
  return { pk: `TENANT_TASKS#${tenantId}`, sk: `${createdAt}#${taskId}` };
}

function dueTaskKey(nextAttemptAt: string, taskId: string) {
  return { pk: "REGISTRATION_TASK_DUE", sk: `${nextAttemptAt}#${taskId}` };
}

function sessionTaskLookupKey(sessionId: string) {
  return { pk: "REGISTRATION_TASK_SESSION", sk: sessionId };
}

function usageEntryKey(tenantId: string, billingPeriod: string, usageEntryId: string) {
  return { pk: `USAGE#${tenantId}#${billingPeriod}`, sk: usageEntryId };
}

function sessionUsageLookupKey(sessionId: string) {
  return { pk: "USAGE_BY_SESSION", sk: sessionId };
}

function adminAuditKey(createdAt: string, eventId: string) {
  return { pk: "ADMIN_AUDIT", sk: `${createdAt}#${eventId}` };
}

function checkoutRateLimitKey(scope: string, identifier: string, windowStart: string) {
  return { pk: `RATE_LIMIT#${scope}#${identifier}`, sk: windowStart };
}

function opsLoginRateLimitKey(scope: string, identifier: string, windowStart: string) {
  return { pk: `OPS_LOGIN#${scope}#${identifier}`, sk: windowStart };
}

async function getItem(key: { pk: string; sk: string }) {
  const response = await getDynamoDocumentClient().send(
    new GetCommand({
      TableName: appStateTableName(),
      Key: key,
    }),
  );

  return asRecord(response.Item);
}

async function queryPartition(
  pk: string,
  options: {
    limit?: number;
    scanIndexForward?: boolean;
    maxSortKey?: string;
  } = {},
) {
  const expressions = ["pk = :pk"];
  const values: Record<string, unknown> = {
    ":pk": pk,
  };

  if (options.maxSortKey) {
    expressions.push("sk <= :max_sk");
    values[":max_sk"] = options.maxSortKey;
  }

  const response = await getDynamoDocumentClient().send(
    new QueryCommand({
      TableName: appStateTableName(),
      KeyConditionExpression: expressions.join(" AND "),
      ExpressionAttributeValues: values,
      Limit: options.limit,
      ScanIndexForward: options.scanIndexForward,
    }),
  );

  return (response.Items || []).map((item) => asRecord(item)).filter(Boolean) as Array<
    Record<string, unknown>
  >;
}

function normalizeTenant(value: unknown): Tenant | null {
  const item = asRecord(value);
  const tenantId = asString(item?.tenant_id) || asString(item?.sk);
  const name = asString(item?.name);
  const slug = asString(item?.slug);
  const contactEmail = asString(item?.contact_email);
  const createdAt = asIsoTimestamp(item?.created_at);
  const updatedAt = asIsoTimestamp(item?.updated_at);

  if (!tenantId || !name || !slug || !contactEmail || !createdAt || !updatedAt) {
    return null;
  }

  return {
    tenant_id: tenantId,
    name,
    slug,
    contact_email: contactEmail,
    status:
      item?.status === "active" ||
      item?.status === "suspended" ||
      item?.status === "archived"
        ? item.status
        : "draft",
    monthly_minimum_usd_cents: asNonNegativeInteger(item?.monthly_minimum_usd_cents, 0),
    service_fee_bps: asNonNegativeInteger(item?.service_fee_bps, 0),
    pilot_notes: asString(item?.pilot_notes),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function normalizeCalendarConnection(value: unknown): CalendarConnection | null {
  const item = asRecord(value);
  const calendarConnectionId =
    asString(item?.calendar_connection_id) || asString(item?.sk);
  const tenantId = asString(item?.tenant_id);
  const slug = asString(item?.slug);
  const displayName = asString(item?.display_name);
  const createdAt = asIsoTimestamp(item?.created_at);
  const updatedAt = asIsoTimestamp(item?.updated_at);

  if (!calendarConnectionId || !tenantId || !slug || !displayName || !createdAt || !updatedAt) {
    return null;
  }

  return {
    calendar_connection_id: calendarConnectionId,
    tenant_id: tenantId,
    slug,
    display_name: displayName,
    status:
      item?.status === "active" ||
      item?.status === "sync_error" ||
      item?.status === "disabled"
        ? item.status
        : "pending_validation",
    luma_api_secret_ref: asString(item?.luma_api_secret_ref),
    luma_webhook_secret_ref: asString(item?.luma_webhook_secret_ref),
    luma_webhook_id: asString(item?.luma_webhook_id),
    last_validated_at: asIsoTimestamp(item?.last_validated_at),
    last_synced_at: asIsoTimestamp(item?.last_synced_at),
    last_sync_error: asString(item?.last_sync_error),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function normalizeCipherPayConnection(value: unknown): CipherPayConnection | null {
  const item = asRecord(value);
  const cipherpayConnectionId =
    asString(item?.cipherpay_connection_id) || asString(item?.sk);
  const tenantId = asString(item?.tenant_id);
  const calendarConnectionId = asString(item?.calendar_connection_id);
  const apiBaseUrl = asString(item?.api_base_url);
  const checkoutBaseUrl = asString(item?.checkout_base_url);
  const createdAt = asIsoTimestamp(item?.created_at);
  const updatedAt = asIsoTimestamp(item?.updated_at);

  if (
    !cipherpayConnectionId ||
    !tenantId ||
    !calendarConnectionId ||
    !apiBaseUrl ||
    !checkoutBaseUrl ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    cipherpay_connection_id: cipherpayConnectionId,
    tenant_id: tenantId,
    calendar_connection_id: calendarConnectionId,
    network: item?.network === "mainnet" ? "mainnet" : "testnet",
    api_base_url: apiBaseUrl,
    checkout_base_url: checkoutBaseUrl,
    cipherpay_api_secret_ref: asString(item?.cipherpay_api_secret_ref),
    cipherpay_webhook_secret_ref: asString(item?.cipherpay_webhook_secret_ref),
    status:
      item?.status === "active" ||
      item?.status === "error" ||
      item?.status === "disabled"
        ? item.status
        : "pending_validation",
    last_validated_at: asIsoTimestamp(item?.last_validated_at),
    last_validation_error: asString(item?.last_validation_error),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function normalizeEventMirror(value: unknown): EventMirror | null {
  const item = asRecord(value);
  const calendarConnectionId = asString(item?.calendar_connection_id);
  const tenantId = asString(item?.tenant_id);
  const eventApiId = asString(item?.event_api_id) || asString(item?.sk);
  const name = asString(item?.name);
  const startAt = asIsoTimestamp(item?.start_at);
  const createdAt = asIsoTimestamp(item?.created_at);
  const updatedAt = asIsoTimestamp(item?.updated_at);

  if (!calendarConnectionId || !tenantId || !eventApiId || !name || !startAt || !createdAt || !updatedAt) {
    return null;
  }

  return {
    event_mirror_id:
      asString(item?.event_mirror_id) || `${calendarConnectionId}:${eventApiId}`,
    tenant_id: tenantId,
    calendar_connection_id: calendarConnectionId,
    event_api_id: eventApiId,
    name,
    start_at: startAt,
    end_at: asIsoTimestamp(item?.end_at),
    timezone: asString(item?.timezone),
    description: asString(item?.description),
    cover_url: asString(item?.cover_url),
    url: asString(item?.url),
    location_label: asString(item?.location_label),
    location_note: asString(item?.location_note),
    sync_status:
      item?.sync_status === "canceled" ||
      item?.sync_status === "hidden" ||
      item?.sync_status === "error"
        ? item.sync_status
        : "active",
    zcash_enabled: asBoolean(item?.zcash_enabled),
    zcash_enabled_reason: asString(item?.zcash_enabled_reason),
    last_synced_at: asIsoTimestamp(item?.last_synced_at),
    last_sync_hash: asString(item?.last_sync_hash),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function normalizeTicketMirror(value: unknown): TicketMirror | null {
  const item = asRecord(value);
  const tenantId = asString(item?.tenant_id);
  const calendarConnectionId = asString(item?.calendar_connection_id);
  const eventApiId = asString(item?.event_api_id);
  const ticketTypeApiId = asString(item?.ticket_type_api_id) || asString(item?.sk);
  const name = asString(item?.name);
  const createdAt = asIsoTimestamp(item?.created_at);
  const updatedAt = asIsoTimestamp(item?.updated_at);

  if (
    !tenantId ||
    !calendarConnectionId ||
    !eventApiId ||
    !ticketTypeApiId ||
    !name ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    ticket_mirror_id: asString(item?.ticket_mirror_id) || `${eventApiId}:${ticketTypeApiId}`,
    tenant_id: tenantId,
    calendar_connection_id: calendarConnectionId,
    event_api_id: eventApiId,
    ticket_type_api_id: ticketTypeApiId,
    name,
    currency: asString(item?.currency),
    amount: asFiniteNumber(item?.amount),
    description: asString(item?.description),
    active: asBoolean(item?.active, true),
    price_source: item?.price_source === "fallback" ? "fallback" : "amount",
    zcash_enabled: asBoolean(item?.zcash_enabled),
    zcash_enabled_reason: asString(item?.zcash_enabled_reason),
    confirmed_fixed_price: asBoolean(item?.confirmed_fixed_price),
    confirmed_no_approval_required: asBoolean(item?.confirmed_no_approval_required),
    confirmed_no_extra_required_questions: asBoolean(
      item?.confirmed_no_extra_required_questions,
    ),
    automatic_eligibility_status:
      item?.automatic_eligibility_status === "eligible" ? "eligible" : "ineligible",
    automatic_eligibility_reasons: Array.isArray(item?.automatic_eligibility_reasons)
      ? item.automatic_eligibility_reasons
          .map((entry) => asString(entry))
          .filter(Boolean) as string[]
      : [],
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function normalizeCheckoutSession(value: unknown): CheckoutSession | null {
  const item = asRecord(value);
  const sessionId = asString(item?.session_id) || asString(item?.sk);
  const tenantId = asString(item?.tenant_id);
  const calendarConnectionId = asString(item?.calendar_connection_id);
  const cipherpayConnectionId = asString(item?.cipherpay_connection_id);
  const publicCalendarSlug = asString(item?.public_calendar_slug);
  const eventApiId = asString(item?.event_api_id);
  const eventName = asString(item?.event_name);
  const ticketTypeApiId = asString(item?.ticket_type_api_id);
  const ticketTypeName = asString(item?.ticket_type_name);
  const attendeeName = asString(item?.attendee_name);
  const attendeeEmail = asString(item?.attendee_email);
  const amount = asFiniteNumber(item?.amount);
  const createdAt = asIsoTimestamp(item?.created_at);
  const updatedAt = asIsoTimestamp(item?.updated_at);
  const invoiceId = asString(item?.cipherpay_invoice_id);
  const currency = asString(item?.currency);

  if (
    !sessionId ||
    !tenantId ||
    !calendarConnectionId ||
    !cipherpayConnectionId ||
    !publicCalendarSlug ||
    !eventApiId ||
    !eventName ||
    !ticketTypeApiId ||
    !ticketTypeName ||
    !attendeeName ||
    !attendeeEmail ||
    amount == null ||
    !invoiceId ||
    !currency ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return applyDerivedCheckoutSessionState({
    session_id: sessionId,
    tenant_id: tenantId,
    calendar_connection_id: calendarConnectionId,
    cipherpay_connection_id: cipherpayConnectionId,
    public_calendar_slug: publicCalendarSlug,
    network: item?.network === "mainnet" ? "mainnet" : "testnet",
    event_api_id: eventApiId,
    event_name: eventName,
    ticket_type_api_id: ticketTypeApiId,
    ticket_type_name: ticketTypeName,
    attendee_name: attendeeName,
    attendee_email: attendeeEmail,
    amount,
    currency: normalizeCurrencyCode(currency),
    pricing_source: "mirror",
    pricing_snapshot_json: asRecord(item?.pricing_snapshot_json) || {},
    service_fee_bps_snapshot: asNonNegativeInteger(item?.service_fee_bps_snapshot, 0),
    service_fee_amount_snapshot: asFiniteNumber(item?.service_fee_amount_snapshot) || 0,
    checkout_url: asString(item?.checkout_url),
    cipherpay_invoice_id: invoiceId,
    cipherpay_memo_code: asString(item?.cipherpay_memo_code),
    cipherpay_payment_address: asString(item?.cipherpay_payment_address),
    cipherpay_zcash_uri: asString(item?.cipherpay_zcash_uri),
    cipherpay_price_zec: asFiniteNumber(item?.cipherpay_price_zec),
    cipherpay_expires_at: asIsoTimestamp(item?.cipherpay_expires_at),
    status:
      item?.status === "draft" ||
      item?.status === "pending" ||
      item?.status === "underpaid" ||
      item?.status === "detected" ||
      item?.status === "confirmed" ||
      item?.status === "expired" ||
      item?.status === "refunded"
        ? item.status
        : "unknown",
    registration_status:
      item?.registration_status === "registered"
        ? "registered"
        : item?.registration_status === "failed"
          ? "failed"
          : "pending",
    registration_task_id: asString(item?.registration_task_id),
    registration_error: asString(item?.registration_error),
    registration_failure_code: asString(item?.registration_failure_code),
    registration_attempt_count: asNonNegativeInteger(item?.registration_attempt_count, 0),
    registration_last_attempt_at: asIsoTimestamp(item?.registration_last_attempt_at),
    registration_next_retry_at: asIsoTimestamp(item?.registration_next_retry_at),
    luma_registration_json: asRecord(item?.luma_registration_json),
    last_event_type: asString(item?.last_event_type),
    last_event_at: asIsoTimestamp(item?.last_event_at),
    last_txid: asString(item?.last_txid),
    last_payload_json: asRecord(item?.last_payload_json),
    detected_at: asIsoTimestamp(item?.detected_at),
    confirmed_at: asIsoTimestamp(item?.confirmed_at),
    registered_at: asIsoTimestamp(item?.registered_at),
    refunded_at: asIsoTimestamp(item?.refunded_at),
    created_at: createdAt,
    updated_at: updatedAt,
  });
}

function normalizeWebhookDelivery(value: unknown): WebhookDelivery | null {
  const item = asRecord(value);
  const webhookDeliveryId = asString(item?.webhook_delivery_id);
  const provider = asString(item?.provider);
  const receivedAt = asIsoTimestamp(item?.received_at);

  if (!webhookDeliveryId || !receivedAt || (provider !== "cipherpay" && provider !== "luma")) {
    return null;
  }

  return {
    webhook_delivery_id: webhookDeliveryId,
    provider,
    tenant_id: asString(item?.tenant_id),
    calendar_connection_id: asString(item?.calendar_connection_id),
    session_id: asString(item?.session_id),
    cipherpay_invoice_id: asString(item?.cipherpay_invoice_id),
    event_api_id: asString(item?.event_api_id),
    event_type: asString(item?.event_type),
    signature_valid: asBoolean(item?.signature_valid),
    validation_error: asString(item?.validation_error),
    request_body_json: asRecord(item?.request_body_json),
    request_headers_json: asRecord(item?.request_headers_json),
    received_at: receivedAt,
    applied_at: asIsoTimestamp(item?.applied_at),
    apply_status:
      item?.apply_status === "applied" ||
      item?.apply_status === "ignored" ||
      item?.apply_status === "error"
        ? item.apply_status
        : "received",
  };
}

function normalizeRegistrationTask(value: unknown): RegistrationTask | null {
  const item = asRecord(value);
  const taskId = asString(item?.task_id) || asString(item?.sk);
  const tenantId = asString(item?.tenant_id);
  const calendarConnectionId = asString(item?.calendar_connection_id);
  const sessionId = asString(item?.session_id);
  const invoiceId = asString(item?.cipherpay_invoice_id);
  const nextAttemptAt = asIsoTimestamp(item?.next_attempt_at);
  const createdAt = asIsoTimestamp(item?.created_at);
  const updatedAt = asIsoTimestamp(item?.updated_at);

  if (
    !taskId ||
    !tenantId ||
    !calendarConnectionId ||
    !sessionId ||
    !invoiceId ||
    !nextAttemptAt ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    task_id: taskId,
    tenant_id: tenantId,
    calendar_connection_id: calendarConnectionId,
    session_id: sessionId,
    cipherpay_invoice_id: invoiceId,
    status:
      item?.status === "in_progress" ||
      item?.status === "retry_wait" ||
      item?.status === "succeeded" ||
      item?.status === "failed" ||
      item?.status === "dead_letter"
        ? item.status
        : "pending",
    attempt_count: asNonNegativeInteger(item?.attempt_count, 0),
    next_attempt_at: nextAttemptAt,
    last_error: asString(item?.last_error),
    created_at: createdAt,
    updated_at: updatedAt,
    last_attempt_at: asIsoTimestamp(item?.last_attempt_at),
  };
}

function normalizeUsageLedgerEntry(value: unknown): UsageLedgerEntry | null {
  const item = asRecord(value);
  const usageEntryId = asString(item?.usage_entry_id) || asString(item?.sk);
  const tenantId = asString(item?.tenant_id);
  const calendarConnectionId = asString(item?.calendar_connection_id);
  const sessionId = asString(item?.session_id);
  const invoiceId = asString(item?.cipherpay_invoice_id);
  const eventApiId = asString(item?.event_api_id);
  const recognizedAt = asIsoTimestamp(item?.recognized_at);
  const billingPeriod = asString(item?.billing_period);
  const currency = asString(item?.currency);

  if (
    !usageEntryId ||
    !tenantId ||
    !calendarConnectionId ||
    !sessionId ||
    !invoiceId ||
    !eventApiId ||
    !recognizedAt ||
    !billingPeriod ||
    !currency
  ) {
    return null;
  }

  return {
    usage_entry_id: usageEntryId,
    tenant_id: tenantId,
    calendar_connection_id: calendarConnectionId,
    session_id: sessionId,
    cipherpay_invoice_id: invoiceId,
    event_api_id: eventApiId,
    gross_amount: asFiniteNumber(item?.gross_amount) || 0,
    currency,
    service_fee_bps: asNonNegativeInteger(item?.service_fee_bps, 0),
    service_fee_amount: asFiniteNumber(item?.service_fee_amount) || 0,
    recognized_at: recognizedAt,
    billing_period: billingPeriod,
    status:
      item?.status === "waived" || item?.status === "credited" ? item.status : "billable",
  };
}

function normalizeAdminAuditEvent(value: unknown): AdminAuditEvent | null {
  const item = asRecord(value);
  const eventId = asString(item?.event_id);
  const eventType = asString(item?.event_type);
  const createdAt = asIsoTimestamp(item?.created_at);

  if (!eventId || !eventType || !createdAt) {
    return null;
  }

  return {
    event_id: eventId,
    event_type: eventType,
    actor_ip: asString(item?.actor_ip),
    actor_origin: asString(item?.actor_origin),
    request_headers_json: asRecord(item?.request_headers_json),
    metadata_json: asRecord(item?.metadata_json),
    created_at: createdAt,
  };
}

export async function putTenant(tenant: Tenant) {
  await Promise.all([
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...tenantKey(tenant.tenant_id),
          ...tenant,
        },
      }),
    ),
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...tenantSlugKey(tenant.slug),
          tenant_id: tenant.tenant_id,
          slug: tenant.slug,
        },
      }),
    ),
  ]);

  return tenant;
}

export async function getTenant(tenantId: string) {
  return normalizeTenant(await getItem(tenantKey(tenantId)));
}

export async function getTenantBySlug(slug: string) {
  const lookup = await getItem(tenantSlugKey(slug));
  const tenantId = asString(lookup?.tenant_id);
  return tenantId ? getTenant(tenantId) : null;
}

export async function listTenants() {
  try {
    const items = await queryPartition("TENANT");
    return sortByIsoDateDesc(
      items.map(normalizeTenant).filter(Boolean) as Tenant[],
      (item) => item.updated_at,
    );
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [] as Tenant[];
    }

    throw error;
  }
}

export async function putCalendarConnection(connection: CalendarConnection) {
  await Promise.all([
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...calendarConnectionKey(connection.calendar_connection_id),
          ...connection,
        },
      }),
    ),
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...tenantCalendarKey(
            connection.tenant_id,
            connection.created_at,
            connection.calendar_connection_id,
          ),
          ...connection,
        },
      }),
    ),
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...calendarSlugKey(connection.slug),
          tenant_id: connection.tenant_id,
          calendar_connection_id: connection.calendar_connection_id,
        },
      }),
    ),
  ]);

  return connection;
}

export async function getCalendarConnection(calendarConnectionId: string) {
  return normalizeCalendarConnection(await getItem(calendarConnectionKey(calendarConnectionId)));
}

export async function getCalendarConnectionBySlug(slug: string) {
  const lookup = await getItem(calendarSlugKey(slug));
  const calendarConnectionId = asString(lookup?.calendar_connection_id);
  return calendarConnectionId ? getCalendarConnection(calendarConnectionId) : null;
}

export async function listCalendarConnectionsByTenant(tenantId: string) {
  try {
    const items = await queryPartition(`TENANT_CALENDARS#${tenantId}`);
    return sortByIsoDateDesc(
      items.map(normalizeCalendarConnection).filter(Boolean) as CalendarConnection[],
      (item) => item.updated_at,
    );
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [] as CalendarConnection[];
    }

    throw error;
  }
}

export async function putCipherPayConnection(connection: CipherPayConnection) {
  await Promise.all([
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...cipherPayConnectionKey(connection.cipherpay_connection_id),
          ...connection,
        },
      }),
    ),
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...tenantCipherPayKey(
            connection.tenant_id,
            connection.created_at,
            connection.cipherpay_connection_id,
          ),
          ...connection,
        },
      }),
    ),
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...calendarCipherPayKey(connection.calendar_connection_id),
          cipherpay_connection_id: connection.cipherpay_connection_id,
        },
      }),
    ),
  ]);

  return connection;
}

export async function getCipherPayConnection(cipherpayConnectionId: string) {
  return normalizeCipherPayConnection(
    await getItem(cipherPayConnectionKey(cipherpayConnectionId)),
  );
}

export async function getCipherPayConnectionByCalendar(calendarConnectionId: string) {
  const lookup = await getItem(calendarCipherPayKey(calendarConnectionId));
  const cipherpayConnectionId = asString(lookup?.cipherpay_connection_id);
  return cipherpayConnectionId ? getCipherPayConnection(cipherpayConnectionId) : null;
}

export async function listCipherPayConnectionsByTenant(tenantId: string) {
  try {
    const items = await queryPartition(`TENANT_CIPHERPAY#${tenantId}`);
    return sortByIsoDateDesc(
      items.map(normalizeCipherPayConnection).filter(Boolean) as CipherPayConnection[],
      (item) => item.updated_at,
    );
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [] as CipherPayConnection[];
    }

    throw error;
  }
}

export async function putEventMirror(event: EventMirror) {
  await getDynamoDocumentClient().send(
    new PutCommand({
      TableName: appStateTableName(),
      Item: {
        ...eventMirrorKey(event.calendar_connection_id, event.event_api_id),
        ...event,
      },
    }),
  );

  return event;
}

export async function getEventMirror(calendarConnectionId: string, eventApiId: string) {
  return normalizeEventMirror(await getItem(eventMirrorKey(calendarConnectionId, eventApiId)));
}

export async function listEventMirrorsByCalendar(calendarConnectionId: string) {
  try {
    const items = await queryPartition(`EVENT#${calendarConnectionId}`);
    return sortByIsoDateDesc(
      items.map(normalizeEventMirror).filter(Boolean) as EventMirror[],
      (item) => item.start_at,
    );
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [] as EventMirror[];
    }

    throw error;
  }
}

export async function putTicketMirror(ticket: TicketMirror) {
  await getDynamoDocumentClient().send(
    new PutCommand({
      TableName: appStateTableName(),
      Item: {
        ...ticketMirrorKey(ticket.event_api_id, ticket.ticket_type_api_id),
        ...ticket,
      },
    }),
  );

  return ticket;
}

export async function getTicketMirror(eventApiId: string, ticketTypeApiId: string) {
  return normalizeTicketMirror(await getItem(ticketMirrorKey(eventApiId, ticketTypeApiId)));
}

export async function listTicketMirrorsByEvent(eventApiId: string) {
  try {
    const items = await queryPartition(`TICKET#${eventApiId}`);
    return sortByIsoDateDesc(
      items.map(normalizeTicketMirror).filter(Boolean) as TicketMirror[],
      (item) => item.updated_at,
    );
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [] as TicketMirror[];
    }

    throw error;
  }
}

export async function putSession(session: CheckoutSession) {
  await Promise.all([
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...sessionKey(session.session_id),
          ...session,
        },
      }),
    ),
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...recentSessionKey(session.created_at, session.session_id),
          ...session,
        },
      }),
    ),
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...tenantSessionKey(session.tenant_id, session.created_at, session.session_id),
          ...session,
        },
      }),
    ),
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...invoiceLookupKey(session.cipherpay_invoice_id),
          session_id: session.session_id,
        },
      }),
    ),
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...attendeeLookupKey(
            session.tenant_id,
            session.calendar_connection_id,
            session.event_api_id,
            session.ticket_type_api_id,
            session.attendee_email,
            session.created_at,
            session.session_id,
          ),
          session_id: session.session_id,
        },
      }),
    ),
  ]);

  return session;
}

export async function getSession(sessionId: string) {
  return normalizeCheckoutSession(await getItem(sessionKey(sessionId)));
}

export async function getSessionByInvoiceId(invoiceId: string) {
  const lookup = await getItem(invoiceLookupKey(invoiceId));
  const sessionId = asString(lookup?.session_id);
  return sessionId ? getSession(sessionId) : null;
}

export async function updateSession(
  sessionId: string,
  patch: Partial<CheckoutSession>,
) {
  const current = await getSession(sessionId);
  if (!current) {
    throw new Error(`Session ${sessionId} was not found.`);
  }

  const next = normalizeCheckoutSession({
    ...current,
    ...patch,
    session_id: current.session_id,
    created_at: current.created_at,
    updated_at: nowIso(),
  });

  if (!next) {
    throw new Error("Session update produced an invalid session shape.");
  }

  return putSession(next);
}

export async function listRecentSessions(limit = 20) {
  try {
    const items = await queryPartition("SESSION_RECENT", {
      limit,
      scanIndexForward: false,
    });
    return items.map(normalizeCheckoutSession).filter(Boolean) as CheckoutSession[];
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [] as CheckoutSession[];
    }

    throw error;
  }
}

export async function listSessionsByTenant(tenantId: string, limit = 50) {
  try {
    const items = await queryPartition(`TENANT_SESSIONS#${tenantId}`, {
      limit,
      scanIndexForward: false,
    });
    return items.map(normalizeCheckoutSession).filter(Boolean) as CheckoutSession[];
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [] as CheckoutSession[];
    }

    throw error;
  }
}

export async function findLatestSessionForAttendee({
  tenantId,
  calendarConnectionId,
  eventApiId,
  ticketTypeApiId,
  attendeeEmail,
}: {
  tenantId: string;
  calendarConnectionId: string;
  eventApiId: string;
  ticketTypeApiId: string;
  attendeeEmail: string;
}) {
  try {
    const items = await queryPartition(
      attendeeLookupKey(
        tenantId,
        calendarConnectionId,
        eventApiId,
        ticketTypeApiId,
        attendeeEmail,
        nowIso(),
        "placeholder",
      ).pk,
      {
        limit: 1,
        scanIndexForward: false,
      },
    );
    const sessionId = asString(items[0]?.session_id);
    return sessionId ? getSession(sessionId) : null;
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return null;
    }

    throw error;
  }
}

export async function putWebhookDelivery(delivery: WebhookDelivery) {
  const writes = [
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...webhookKey(delivery.received_at, delivery.webhook_delivery_id),
          ...delivery,
        },
      }),
    ),
  ];

  if (delivery.tenant_id) {
    writes.push(
      getDynamoDocumentClient().send(
        new PutCommand({
          TableName: appStateTableName(),
          Item: {
            ...tenantWebhookKey(
              delivery.tenant_id,
              delivery.received_at,
              delivery.webhook_delivery_id,
            ),
            ...delivery,
          },
        }),
      ),
    );
  }

  await Promise.all(writes);
  return delivery;
}

export async function updateWebhookDelivery(
  webhookDeliveryId: string,
  receivedAt: string,
  patch: Partial<WebhookDelivery>,
) {
  const current = normalizeWebhookDelivery(
    await getItem(webhookKey(receivedAt, webhookDeliveryId)),
  );
  if (!current) {
    throw new Error(`Webhook delivery ${webhookDeliveryId} was not found.`);
  }

  const next = normalizeWebhookDelivery({
    ...current,
    ...patch,
    webhook_delivery_id: current.webhook_delivery_id,
    provider: current.provider,
    received_at: current.received_at,
  });

  if (!next) {
    throw new Error("Webhook delivery update produced an invalid shape.");
  }

  return putWebhookDelivery(next);
}

export async function listRecentWebhookDeliveries(limit = 20) {
  try {
    const items = await queryPartition("WEBHOOK", {
      limit,
      scanIndexForward: false,
    });
    return items.map(normalizeWebhookDelivery).filter(Boolean) as WebhookDelivery[];
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [] as WebhookDelivery[];
    }

    throw error;
  }
}

export async function listWebhookDeliveriesByTenant(tenantId: string, limit = 50) {
  try {
    const items = await queryPartition(`TENANT_WEBHOOKS#${tenantId}`, {
      limit,
      scanIndexForward: false,
    });
    return items.map(normalizeWebhookDelivery).filter(Boolean) as WebhookDelivery[];
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [] as WebhookDelivery[];
    }

    throw error;
  }
}

export async function putRegistrationTask(task: RegistrationTask) {
  const existing = await getRegistrationTask(task.task_id).catch(() => null);

  const writes = [
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...taskKey(task.task_id),
          ...task,
        },
      }),
    ),
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...recentTaskKey(task.created_at, task.task_id),
          ...task,
        },
      }),
    ),
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...tenantTaskKey(task.tenant_id, task.created_at, task.task_id),
          ...task,
        },
      }),
    ),
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...sessionTaskLookupKey(task.session_id),
          task_id: task.task_id,
        },
      }),
    ),
  ];

  if (existing?.next_attempt_at && existing.next_attempt_at !== task.next_attempt_at) {
    writes.push(
      getDynamoDocumentClient().send(
        new DeleteCommand({
          TableName: appStateTableName(),
          Key: dueTaskKey(existing.next_attempt_at, existing.task_id),
        }),
      ),
    );
  }

  if (task.status === "pending" || task.status === "retry_wait" || task.status === "in_progress") {
    writes.push(
      getDynamoDocumentClient().send(
        new PutCommand({
          TableName: appStateTableName(),
          Item: {
            ...dueTaskKey(task.next_attempt_at, task.task_id),
            task_id: task.task_id,
          },
        }),
      ),
    );
  } else if (existing?.next_attempt_at) {
    writes.push(
      getDynamoDocumentClient().send(
        new DeleteCommand({
          TableName: appStateTableName(),
          Key: dueTaskKey(existing.next_attempt_at, existing.task_id),
        }),
      ),
    );
  }

  await Promise.all(writes);
  return task;
}

export async function getRegistrationTask(taskId: string) {
  return normalizeRegistrationTask(await getItem(taskKey(taskId)));
}

export async function getRegistrationTaskBySession(sessionId: string) {
  const lookup = await getItem(sessionTaskLookupKey(sessionId));
  const taskId = asString(lookup?.task_id);
  return taskId ? getRegistrationTask(taskId) : null;
}

export async function listRecentRegistrationTasks(limit = 20) {
  try {
    const items = await queryPartition("REGISTRATION_TASK_RECENT", {
      limit,
      scanIndexForward: false,
    });
    return items.map(normalizeRegistrationTask).filter(Boolean) as RegistrationTask[];
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [] as RegistrationTask[];
    }

    throw error;
  }
}

export async function listRegistrationTasksByTenant(tenantId: string, limit = 50) {
  try {
    const items = await queryPartition(`TENANT_TASKS#${tenantId}`, {
      limit,
      scanIndexForward: false,
    });
    return items.map(normalizeRegistrationTask).filter(Boolean) as RegistrationTask[];
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [] as RegistrationTask[];
    }

    throw error;
  }
}

export async function listDueRegistrationTasks(limit = 20, dueAt = nowIso()) {
  try {
    const items = await queryPartition("REGISTRATION_TASK_DUE", {
      limit,
      maxSortKey: `${dueAt}#~`,
      scanIndexForward: true,
    });
    const tasks = await Promise.all(
      items
        .map((item) => asString(item.task_id))
        .filter(Boolean)
        .map((taskId) => getRegistrationTask(taskId as string)),
    );

    return tasks.filter(Boolean) as RegistrationTask[];
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [] as RegistrationTask[];
    }

    throw error;
  }
}

export async function putUsageLedgerEntry(entry: UsageLedgerEntry) {
  await Promise.all([
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...usageEntryKey(entry.tenant_id, entry.billing_period, entry.usage_entry_id),
          ...entry,
        },
      }),
    ),
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...sessionUsageLookupKey(entry.session_id),
          usage_entry_id: entry.usage_entry_id,
          tenant_id: entry.tenant_id,
          billing_period: entry.billing_period,
        },
      }),
    ),
  ]);

  return entry;
}

export async function getUsageLedgerEntryBySession(sessionId: string) {
  const lookup = await getItem(sessionUsageLookupKey(sessionId));
  const usageEntryId = asString(lookup?.usage_entry_id);
  const tenantId = asString(lookup?.tenant_id);
  const billingPeriod = asString(lookup?.billing_period);

  if (!usageEntryId || !tenantId || !billingPeriod) {
    return null;
  }

  return normalizeUsageLedgerEntry(
    await getItem(usageEntryKey(tenantId, billingPeriod, usageEntryId)),
  );
}

export async function listUsageLedgerEntriesByTenantPeriod(
  tenantId: string,
  billingPeriod: string,
) {
  try {
    const items = await queryPartition(`USAGE#${tenantId}#${billingPeriod}`);
    return items.map(normalizeUsageLedgerEntry).filter(Boolean) as UsageLedgerEntry[];
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [] as UsageLedgerEntry[];
    }

    throw error;
  }
}

export async function putAdminAuditEvent(
  event: Omit<AdminAuditEvent, "event_id" | "created_at"> & {
    event_id?: string;
    created_at?: string | null;
  },
) {
  const next: AdminAuditEvent = {
    event_id: event.event_id || randomUUID(),
    event_type: event.event_type,
    actor_ip: event.actor_ip,
    actor_origin: event.actor_origin,
    request_headers_json: event.request_headers_json,
    metadata_json: event.metadata_json,
    created_at: event.created_at || nowIso(),
  };

  try {
    await getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          ...adminAuditKey(next.created_at, next.event_id),
          ...next,
        },
      }),
    );
  } catch (error) {
    if (!isMissingLocalStateError(error)) {
      throw error;
    }
  }

  return next;
}

export async function listAdminAuditEvents(limit = 20) {
  try {
    const items = await queryPartition("ADMIN_AUDIT", {
      limit,
      scanIndexForward: false,
    });
    return items.map(normalizeAdminAuditEvent).filter(Boolean) as AdminAuditEvent[];
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [] as AdminAuditEvent[];
    }

    throw error;
  }
}

export async function consumeCheckoutRateLimit({
  ipAddress,
  attendeeEmail,
  tenantId,
  eventApiId,
}: {
  ipAddress: string | null;
  attendeeEmail: string;
  tenantId: string;
  eventApiId: string;
}) {
  const now = Date.now();
  const windowSeconds = 10 * 60;
  const windowStart = new Date(
    Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000,
  ).toISOString();
  const expiresAt = new Date(now + windowSeconds * 1000).toISOString();
  const timestamp = nowIso();
  const ipIdentifier = hashIdentifier(ipAddress || "unknown");
  const attendeeIdentifier = hashIdentifier(
    `${tenantId}#${normalizeEmailAddress(attendeeEmail)}#${eventApiId}`,
  );

  const [ipResult, attendeeResult] = await Promise.all([
    getDynamoDocumentClient().send(
      new UpdateCommand({
        TableName: appStateTableName(),
        Key: checkoutRateLimitKey("IP", ipIdentifier, windowStart),
        UpdateExpression:
          "SET request_count = if_not_exists(request_count, :zero) + :one, expires_at = :expires_at, updated_at = :updated_at, created_at = if_not_exists(created_at, :created_at)",
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
          ":expires_at": expiresAt,
          ":updated_at": timestamp,
          ":created_at": timestamp,
        },
        ReturnValues: "ALL_NEW",
      }),
    ),
    getDynamoDocumentClient().send(
      new UpdateCommand({
        TableName: appStateTableName(),
        Key: checkoutRateLimitKey("ATTENDEE", attendeeIdentifier, windowStart),
        UpdateExpression:
          "SET request_count = if_not_exists(request_count, :zero) + :one, expires_at = :expires_at, updated_at = :updated_at, created_at = if_not_exists(created_at, :created_at)",
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
          ":expires_at": expiresAt,
          ":updated_at": timestamp,
          ":created_at": timestamp,
        },
        ReturnValues: "ALL_NEW",
      }),
    ),
  ]);

  const ipCount = asFiniteNumber(asRecord(ipResult.Attributes)?.request_count) || 0;
  if (ipCount > 12) {
    return {
      ok: false,
      retry_after_seconds: windowSeconds,
      reason: "Too many checkout attempts from this IP. Please wait a few minutes and try again.",
    };
  }

  const attendeeCount =
    asFiniteNumber(asRecord(attendeeResult.Attributes)?.request_count) || 0;
  if (attendeeCount > 4) {
    return {
      ok: false,
      retry_after_seconds: windowSeconds,
      reason:
        "Too many checkout attempts for this attendee and event. Please wait a few minutes and try again.",
    };
  }

  return {
    ok: true,
    retry_after_seconds: null,
    reason: null,
  };
}

export async function consumeOpsLoginRateLimit({
  ipAddress,
}: {
  ipAddress: string | null;
}) {
  const now = Date.now();
  const windowSeconds = 10 * 60;
  const windowStart = new Date(
    Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000,
  ).toISOString();
  const expiresAt = new Date(now + windowSeconds * 1000).toISOString();
  const timestamp = nowIso();
  const ipIdentifier = hashIdentifier(ipAddress || "unknown");

  const result = await getDynamoDocumentClient().send(
    new UpdateCommand({
      TableName: appStateTableName(),
      Key: opsLoginRateLimitKey("IP", ipIdentifier, windowStart),
      UpdateExpression:
        "SET request_count = if_not_exists(request_count, :zero) + :one, expires_at = :expires_at, updated_at = :updated_at, created_at = if_not_exists(created_at, :created_at)",
      ExpressionAttributeValues: {
        ":zero": 0,
        ":one": 1,
        ":expires_at": expiresAt,
        ":updated_at": timestamp,
        ":created_at": timestamp,
      },
      ReturnValues: "ALL_NEW",
    }),
  );

  const count = asFiniteNumber(asRecord(result.Attributes)?.request_count) || 0;
  if (count > 20) {
    return {
      ok: false,
      retry_after_seconds: windowSeconds,
      reason: "Too many login attempts. Please wait a few minutes and try again.",
    };
  }

  return {
    ok: true,
    retry_after_seconds: null,
    reason: null,
  };
}

export async function getOpsDashboardData(): Promise<OpsDashboardData> {
  const [tenants, recentSessions, recentWebhooks, recentTasks] = await Promise.all([
    listTenants(),
    listRecentSessions(20),
    listRecentWebhookDeliveries(20),
    listRecentRegistrationTasks(20),
  ]);

  const tenantSummaries = await Promise.all(
    tenants.map(async (tenant) => {
      const [calendars, sessions, tasks] = await Promise.all([
        listCalendarConnectionsByTenant(tenant.tenant_id),
        listSessionsByTenant(tenant.tenant_id, 200),
        listRegistrationTasksByTenant(tenant.tenant_id, 200),
      ]);

      const summary: TenantListItem = {
        tenant,
        active_calendar_count: calendars.filter((calendar) => calendar.status === "active")
          .length,
        recent_session_count: sessions.length,
        open_registration_tasks: tasks.filter(
          (task) => task.status === "pending" || task.status === "retry_wait",
        ).length,
        dead_letter_tasks: tasks.filter((task) => task.status === "dead_letter").length,
      };

      return summary;
    }),
  );

  return {
    tenants: tenantSummaries,
    recent_sessions: recentSessions,
    recent_webhooks: recentWebhooks,
    recent_tasks: recentTasks,
  };
}

export async function buildBillingReportRows(billingPeriod: string) {
  const tenants = await listTenants();
  const rows: BillingReportRow[] = [];

  for (const tenant of tenants) {
    const [calendars, entries] = await Promise.all([
      listCalendarConnectionsByTenant(tenant.tenant_id),
      listUsageLedgerEntriesByTenantPeriod(tenant.tenant_id, billingPeriod),
    ]);
    const calendarsById = new Map(
      calendars.map((calendar) => [calendar.calendar_connection_id, calendar]),
    );
    const grouped = new Map<string, UsageLedgerEntry[]>();
    for (const entry of entries) {
      const key = `${entry.calendar_connection_id}#${entry.currency}`;
      const existing = grouped.get(key) || [];
      existing.push(entry);
      grouped.set(key, existing);
    }

    for (const [key, group] of grouped.entries()) {
      const [calendarConnectionId, currency] = key.split("#");
      const calendar = calendarsById.get(calendarConnectionId);
      rows.push({
        tenant_id: tenant.tenant_id,
        tenant_name: tenant.name,
        calendar_connection_id: calendarConnectionId,
        calendar_display_name: calendar?.display_name || calendarConnectionId,
        billing_period: billingPeriod,
        session_count: group.length,
        gross_volume: Number(
          group.reduce((sum, entry) => sum + entry.gross_amount, 0).toFixed(2),
        ),
        service_fee_due: Number(
          group.reduce((sum, entry) => sum + entry.service_fee_amount, 0).toFixed(2),
        ),
        currency,
      });
    }
  }

  return rows.sort((left, right) => left.tenant_name.localeCompare(right.tenant_name));
}
