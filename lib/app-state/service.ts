import { randomUUID } from "node:crypto";
import {
  getCipherPayConnectionByCalendar,
  getSessionByInvoiceId,
  putWebhookDelivery,
  updateSession,
  updateWebhookDelivery,
  putSession,
} from "@/lib/app-state/state";
import type { CheckoutSession, WebhookDelivery } from "@/lib/app-state/types";
import {
  asRecord,
  calculateServiceFeeZatoshis,
  cipherPayStatusFromEvent,
  normalizeEmailAddress,
  nowIso,
  zecToZatoshis,
} from "@/lib/app-state/utils";
import { createCipherPayInvoice } from "@/lib/cipherpay";
import { extractLumaWebhookEventApiId } from "@/lib/luma-webhook";
import { logEvent } from "@/lib/observability";
import {
  summarizeWebhookHeaders,
  summarizeWebhookPayload,
} from "@/lib/privacy";
import {
  getPublicCalendar,
  getPublicEventPageData,
  getPublicTicket,
} from "@/lib/public/public-calendars";
import { handleCalendarRefreshWebhook } from "@/lib/sync/luma-sync";
import {
  ensureRegistrationTaskForSession,
  processRegistrationTask,
  processDueRegistrationTasks,
  retryRegistrationTaskForSession,
} from "@/lib/tasks/registration-tasks";
import {
  resolveCipherPayClientForCalendar,
  resolveCipherPayWebhookSecretForCalendar,
} from "@/lib/tenancy/service";

type CreateCheckoutInput = {
  attendee_email: string;
  attendee_name: string;
  calendar_slug: string;
  event_api_id: string;
  ticket_type_api_id: string;
};

function hasRegistrationGuestLookup(session: CheckoutSession) {
  const registration = asRecord(session.luma_registration_json);
  const guestLookup = asRecord(registration?.guest_lookup);
  return Boolean(asRecord(guestLookup?.guest));
}

function shouldAttemptInlineRegistration(session: CheckoutSession) {
  if (
    session.registration_status === "registered" &&
    hasRegistrationGuestLookup(session)
  ) {
    return false;
  }

  return session.status === "detected" || session.status === "confirmed";
}

export async function resolveCipherPayWebhookContext(invoiceId: string | null) {
  if (!invoiceId) {
    return {
      session: null,
      secret: null,
    };
  }

  const session = await getSessionByInvoiceId(invoiceId);
  if (!session) {
    return {
      session: null,
      secret: null,
    };
  }

  return {
    session,
    secret: await resolveCipherPayWebhookSecretForCalendar(
      session.calendar_connection_id,
    ),
  };
}

export async function createCheckoutSession(input: CreateCheckoutInput) {
  const calendarData = await getPublicCalendar(input.calendar_slug);
  if (!calendarData) {
    throw new Error("That public calendar was not found or is not active.");
  }

  const eventPageData = await getPublicEventPageData(
    input.calendar_slug,
    input.event_api_id,
  );
  if (!eventPageData) {
    throw new Error("That event is not available for public Zcash checkout.");
  }

  const ticket = await getPublicTicket(
    input.calendar_slug,
    input.event_api_id,
    input.ticket_type_api_id,
  );
  if (!ticket) {
    throw new Error("That ticket is not available for public Zcash checkout.");
  }

  const cipherPayClient = await resolveCipherPayClientForCalendar(
    calendarData.calendar.calendar_connection_id,
  );
  const cipherPayConnection = await getCipherPayConnectionByCalendar(
    calendarData.calendar.calendar_connection_id,
  );
  if (!cipherPayConnection) {
    throw new Error("An active CipherPay connection is required for this calendar.");
  }

  const { invoice, checkout_url } = await createCipherPayInvoice(cipherPayClient, {
    amount: ticket.amount || 0,
    currency: ticket.currency || "USD",
    product_name: eventPageData.event.name,
    size: ticket.name,
  });

  const timestamp = nowIso();
  const cipherpayPriceZatoshis = zecToZatoshis(invoice.price_zec);
  const session: CheckoutSession = {
    session_id: randomUUID(),
    tenant_id: calendarData.tenant.tenant_id,
    calendar_connection_id: calendarData.calendar.calendar_connection_id,
    cipherpay_connection_id: cipherPayConnection.cipherpay_connection_id,
    public_calendar_slug: calendarData.calendar.slug,
    network: cipherPayClient.network,
    event_api_id: eventPageData.event.event_api_id,
    event_name: eventPageData.event.name,
    ticket_type_api_id: ticket.ticket_type_api_id,
    ticket_type_name: ticket.name,
    attendee_name: input.attendee_name.trim(),
    attendee_email: normalizeEmailAddress(input.attendee_email),
    amount: ticket.amount || 0,
    currency: ticket.currency || "USD",
    pricing_source: "mirror",
    pricing_snapshot_json: {
      amount: ticket.amount,
      currency: ticket.currency,
      event_name: eventPageData.event.name,
      event_start_at: eventPageData.event.start_at,
      ticket_name: ticket.name,
    },
    service_fee_bps_snapshot: calendarData.tenant.service_fee_bps,
    service_fee_zatoshis_snapshot: calculateServiceFeeZatoshis(
      cipherpayPriceZatoshis,
      calendarData.tenant.service_fee_bps,
    ),
    checkout_url,
    cipherpay_invoice_id: invoice.invoice_id,
    cipherpay_memo_code: invoice.memo_code,
    cipherpay_payment_address: invoice.payment_address,
    cipherpay_zcash_uri: invoice.zcash_uri,
    cipherpay_price_zec: invoice.price_zec,
    cipherpay_price_zatoshis: cipherpayPriceZatoshis,
    cipherpay_expires_at: invoice.expires_at,
    status: invoice.status === "unknown" ? "pending" : invoice.status,
    registration_status: "pending",
    registration_task_id: null,
    registration_error: null,
    registration_failure_code: null,
    registration_attempt_count: 0,
    registration_last_attempt_at: null,
    registration_next_retry_at: null,
    luma_registration_json: null,
    last_event_type: invoice.status,
    last_event_at: timestamp,
    last_txid: invoice.detected_txid,
    last_payload_json: null,
    detected_at: invoice.detected_at,
    confirmed_at: invoice.confirmed_at,
    registered_at: null,
    refunded_at: invoice.refunded_at,
    version: 0,
    created_at: timestamp,
    updated_at: timestamp,
  };

  await putSession(session);
  logEvent("info", "checkout.created", {
    session_id: session.session_id,
    invoice_id: session.cipherpay_invoice_id,
    tenant_id: session.tenant_id,
    event_api_id: session.event_api_id,
    ticket_type_api_id: session.ticket_type_api_id,
  });

  return {
    tenant: calendarData.tenant,
    calendar: calendarData.calendar,
    event: eventPageData.event,
    ticket,
    session,
    invoice: {
      ...invoice,
      checkout_url,
    },
  };
}

export async function processCipherPayWebhook({
  requestBody,
  eventType,
  invoiceId,
  signatureValid,
  validationError,
  requestHeaders,
  txid,
}: {
  requestBody: Record<string, unknown>;
  eventType: string | null;
  invoiceId: string | null;
  signatureValid: boolean;
  validationError: string | null;
  requestHeaders: Record<string, unknown>;
  txid: string | null;
}) {
  const receivedAt = nowIso();
  const resolved = await resolveCipherPayWebhookContext(invoiceId);
  const delivery: WebhookDelivery = {
    webhook_delivery_id: randomUUID(),
    provider: "cipherpay",
    tenant_id: resolved.session?.tenant_id || null,
    calendar_connection_id: resolved.session?.calendar_connection_id || null,
    session_id: resolved.session?.session_id || null,
    cipherpay_invoice_id: invoiceId,
    event_api_id: resolved.session?.event_api_id || null,
    event_type: eventType,
    signature_valid: signatureValid,
    validation_error: validationError,
    request_body_json: summarizeWebhookPayload(requestBody),
    request_headers_json: summarizeWebhookHeaders(requestHeaders),
    received_at: receivedAt,
    applied_at: null,
    apply_status: "received",
  };

  await putWebhookDelivery(delivery);

  if (!signatureValid) {
    await updateWebhookDelivery(delivery.webhook_delivery_id, delivery.received_at, {
      apply_status: "ignored",
      applied_at: nowIso(),
    });
    return null;
  }

  const session = resolved.session;
  if (!session) {
    await updateWebhookDelivery(delivery.webhook_delivery_id, delivery.received_at, {
      apply_status: "ignored",
      applied_at: nowIso(),
    });
    return null;
  }

  let nextSession = await updateSession(session.session_id, (current) => {
    const eventTimestamp =
      (typeof requestBody.timestamp === "string" ? requestBody.timestamp : null) ||
      receivedAt;
    const status = cipherPayStatusFromEvent(eventType, current.status);

    return {
      status,
      last_event_type: eventType,
      last_event_at: eventTimestamp,
      last_txid: txid,
      last_payload_json: summarizeWebhookPayload(requestBody),
      detected_at: status === "detected" ? eventTimestamp : current.detected_at,
      confirmed_at: status === "confirmed" ? eventTimestamp : current.confirmed_at,
      refunded_at: status === "refunded" ? eventTimestamp : current.refunded_at,
    };
  });

  if (shouldAttemptInlineRegistration(nextSession)) {
    const task = await ensureRegistrationTaskForSession(nextSession);
    if (task.status !== "in_progress") {
      await processRegistrationTask(task);
    }
    nextSession = (await getSessionByInvoiceId(nextSession.cipherpay_invoice_id)) || nextSession;
  }

  await updateWebhookDelivery(delivery.webhook_delivery_id, delivery.received_at, {
    apply_status: "applied",
    applied_at: nowIso(),
  });

  logEvent("info", "webhook.applied", {
    session_id: nextSession.session_id,
    invoice_id: nextSession.cipherpay_invoice_id,
    event_type: eventType,
    status: nextSession.status,
  });

  return nextSession;
}

export async function processLumaWebhook({
  calendarConnectionId,
  tenantId,
  requestBody,
  eventType,
  requestAuthenticated,
  signatureValid,
  validationError,
  requestHeaders,
}: {
  calendarConnectionId: string;
  tenantId: string;
  requestBody: Record<string, unknown>;
  eventType: string | null;
  requestAuthenticated: boolean;
  signatureValid: boolean;
  validationError: string | null;
  requestHeaders: Record<string, unknown>;
}) {
  const receivedAt = nowIso();
  const delivery: WebhookDelivery = {
    webhook_delivery_id: randomUUID(),
    provider: "luma",
    tenant_id: tenantId,
    calendar_connection_id: calendarConnectionId,
    session_id: null,
    cipherpay_invoice_id: null,
    event_api_id: extractLumaWebhookEventApiId(requestBody),
    event_type: eventType,
    signature_valid: signatureValid,
    validation_error: validationError,
    request_body_json: summarizeWebhookPayload(requestBody),
    request_headers_json: summarizeWebhookHeaders(requestHeaders),
    received_at: receivedAt,
    applied_at: null,
    apply_status: "received",
  };

  await putWebhookDelivery(delivery);

  if (!requestAuthenticated) {
    await updateWebhookDelivery(delivery.webhook_delivery_id, delivery.received_at, {
      apply_status: "ignored",
      applied_at: nowIso(),
    });
    return {
      applied: false,
      ignored: true,
      reason: validationError || "invalid_signature",
    };
  }

  if (
    eventType !== "event.created" &&
    eventType !== "event.updated" &&
    eventType !== "event.canceled"
  ) {
    await updateWebhookDelivery(delivery.webhook_delivery_id, delivery.received_at, {
      apply_status: "ignored",
      applied_at: nowIso(),
    });
    return {
      applied: false,
      ignored: true,
      reason: `unsupported_event:${eventType || "unknown"}`,
    };
  }

  try {
    const result = await handleCalendarRefreshWebhook(calendarConnectionId);
    await updateWebhookDelivery(delivery.webhook_delivery_id, delivery.received_at, {
      apply_status: "applied",
      applied_at: nowIso(),
    });

    logEvent("info", "luma.webhook.applied", {
      calendar_connection_id: calendarConnectionId,
      tenant_id: tenantId,
      event_type: eventType,
      event_api_id: delivery.event_api_id,
      event_count: result.event_count,
    });

    return {
      applied: true,
      ignored: false,
      ...result,
    };
  } catch (error) {
    await updateWebhookDelivery(delivery.webhook_delivery_id, delivery.received_at, {
      apply_status: "error",
      applied_at: nowIso(),
    });

    const message =
      error instanceof Error ? error.message : "Luma webhook refresh failed";
    logEvent("error", "luma.webhook.apply_failed", {
      calendar_connection_id: calendarConnectionId,
      tenant_id: tenantId,
      event_type: eventType,
      error: message,
    });

    throw error;
  }
}

export async function retryRegistrationForSession(sessionId: string) {
  return retryRegistrationTaskForSession(sessionId);
}

export async function retryDueRegistrations(limit = 10) {
  return processDueRegistrationTasks(limit);
}
