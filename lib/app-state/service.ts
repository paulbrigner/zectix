import {
  addLumaGuest,
  getLumaEventById,
  getLumaGuest,
  listLumaTicketTypes,
} from "@/lib/luma";
import { createCipherPayInvoice } from "@/lib/cipherpay";
import {
  findLatestSessionForAttendee,
  getRuntimeConfig,
  getSession,
  listSessionsNeedingRegistrationRecovery,
  putSession,
  putWebhookEvent,
  upsertSession,
} from "@/lib/app-state/state";
import type {
  CipherPaySessionStatus,
  RuntimeConfigRecord,
  CheckoutSession,
} from "@/lib/app-state/types";
import {
  asIsoTimestamp,
  asRecord,
  cipherPayStatusFromEvent,
  isRegistrationRetryDue,
  normalizeEmailAddress,
  nowIso,
  registrationRetryDelayMinutes,
} from "@/lib/app-state/utils";
import { logEvent } from "@/lib/observability";

type CreateCheckoutInput = {
  attendee_email: string;
  attendee_name: string;
  event_api_id: string;
  ticket_type_api_id: string | null;
};

function requireLumaApiKey(config: RuntimeConfigRecord) {
  if (!config.luma_api_key) {
    throw new Error("Luma API key is not configured. Save it on the admin page first.");
  }

  return config.luma_api_key;
}

function normalizeSessionStatus(status: CipherPaySessionStatus) {
  return status === "unknown" ? "pending" : status;
}

function hasGuestLookup(session: CheckoutSession) {
  const registration = asRecord(session.luma_registration_json);
  const guestLookup = asRecord(registration?.guest_lookup);
  return Boolean(asRecord(guestLookup?.guest));
}

function recentRegistrationAttempt(session: CheckoutSession, cooldownMs = 30_000) {
  if (!session.registration_last_attempt_at) {
    return false;
  }

  const attemptedAtMs = new Date(session.registration_last_attempt_at).getTime();
  if (Number.isNaN(attemptedAtMs)) {
    return false;
  }

  return Date.now() - attemptedAtMs < cooldownMs;
}

function registrationPayloadWithGuestLookup(
  session: CheckoutSession,
  guestLookup: Record<string, unknown>,
) {
  return {
    ...(session.luma_registration_json || {}),
    guest_lookup: guestLookup,
  };
}

const GUEST_ATTACH_RETRY_WINDOW_MS = 30_000;
const GUEST_ATTACH_MAX_ATTEMPTS = 3;

async function attachGuestLookupToRegisteredSession(
  session: CheckoutSession,
  guestLookup: Record<string, unknown>,
) {
  return upsertSession(session.session_id, {
    registration_status: "registered",
    registration_error: null,
    registration_failure_code: null,
    registration_next_retry_at: null,
    luma_registration_json: registrationPayloadWithGuestLookup(session, guestLookup),
    registered_at:
      asIsoTimestamp(asRecord(asRecord(guestLookup)?.guest)?.registered_at) ||
      session.registered_at ||
      nowIso(),
  });
}

function classifyRegistrationFailure(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Luma registration failed";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("429") ||
    normalized.includes("rate limit") ||
    normalized.includes("500") ||
    normalized.includes("502") ||
    normalized.includes("503") ||
    normalized.includes("504")
  ) {
    return {
      code: "transient_provider_error",
      message,
      retryable: true,
    };
  }

  return {
    code: "registration_failed",
    message,
    retryable: false,
  };
}

async function registerAcceptedSession(
  session: CheckoutSession,
  config: RuntimeConfigRecord,
) {
  if (session.registration_status === "registered" && hasGuestLookup(session)) {
    return session;
  }

  const lumaApiKey = requireLumaApiKey(config);
  const attemptAt = nowIso();
  const nextAttemptCount = (session.registration_attempt_count || 0) + 1;
  const attendeeEmail = normalizeEmailAddress(session.attendee_email);

  logEvent("info", "registration.started", {
    session_id: session.session_id,
    invoice_id: session.cipherpay_invoice_id,
    event_api_id: session.event_api_id,
    attempt_count: nextAttemptCount,
  });

  try {
    const result = await addLumaGuest({
      apiKey: lumaApiKey,
      eventApiId: session.event_api_id,
      attendeeEmail,
      attendeeName: session.attendee_name,
      ticketTypeApiId: session.ticket_type_api_id,
    });
    const guestLookup = await getLumaGuest({
      apiKey: lumaApiKey,
      eventApiId: session.event_api_id,
      attendeeEmail,
    }).catch(() => null);
    const registrationPayload = {
      ...(asRecord(result) || {}),
      ...(asRecord(guestLookup) ? { guest_lookup: asRecord(guestLookup) } : {}),
    };

    if (!asRecord(asRecord(guestLookup)?.guest)) {
      const exhaustedAttempts = nextAttemptCount >= GUEST_ATTACH_MAX_ATTEMPTS;
      const nextRetryAt = new Date(
        Date.now() +
          (exhaustedAttempts
            ? registrationRetryDelayMinutes(nextAttemptCount) * 60 * 1000
            : GUEST_ATTACH_RETRY_WINDOW_MS),
      ).toISOString();
      const failureCode = exhaustedAttempts
        ? "guest_creation_unconfirmed"
        : "guest_lookup_pending";
      const registrationMessage = exhaustedAttempts
        ? "Payment accepted, but Luma did not create the attendee record yet. Please retry from Operations or verify the attendee email in Luma."
        : "Payment accepted. Waiting for Luma to attach the attendee pass.";
      logEvent(exhaustedAttempts ? "error" : "warn", exhaustedAttempts ? "registration.guest_creation_unconfirmed" : "registration.pending_guest_lookup", {
        session_id: session.session_id,
        invoice_id: session.cipherpay_invoice_id,
        attempt_count: nextAttemptCount,
        retry_at: nextRetryAt,
        attendee_email: attendeeEmail,
      });
      return upsertSession(session.session_id, {
        registration_status: exhaustedAttempts ? "failed" : "pending",
        registration_error: registrationMessage,
        registration_failure_code: failureCode,
        registration_attempt_count: nextAttemptCount,
        registration_last_attempt_at: attemptAt,
        registration_next_retry_at: nextRetryAt,
        luma_registration_json: registrationPayload,
        registered_at: null,
      });
    }

    const registeredSession = await upsertSession(session.session_id, {
      registration_status: "registered",
      registration_error: null,
      registration_failure_code: null,
      registration_attempt_count: nextAttemptCount,
      registration_last_attempt_at: attemptAt,
      registration_next_retry_at: null,
      luma_registration_json: registrationPayload,
      registered_at: nowIso(),
    });
    logEvent("info", "registration.succeeded", {
      session_id: session.session_id,
      invoice_id: session.cipherpay_invoice_id,
      attempt_count: nextAttemptCount,
    });
    return hydrateRegisteredSessionGuestLookup(registeredSession, config);
  } catch (error) {
    const failure = classifyRegistrationFailure(error);
    const nextRetryAt = failure.retryable
      ? new Date(
          Date.now() + registrationRetryDelayMinutes(nextAttemptCount) * 60 * 1000,
        ).toISOString()
      : null;
    logEvent(failure.retryable ? "warn" : "error", "registration.failed", {
      session_id: session.session_id,
      invoice_id: session.cipherpay_invoice_id,
      attempt_count: nextAttemptCount,
      failure_code: failure.code,
      retry_at: nextRetryAt,
      error: failure.message,
    });
    return upsertSession(session.session_id, {
      registration_status: "failed",
      registration_error: failure.message,
      registration_failure_code: failure.code,
      registration_attempt_count: nextAttemptCount,
      registration_last_attempt_at: attemptAt,
      registration_next_retry_at: nextRetryAt,
    });
  }
}

export async function hydrateRegisteredSessionGuestLookup(
  session: CheckoutSession,
  config?: RuntimeConfigRecord,
) {
  if (session.registration_status !== "registered" || hasGuestLookup(session)) {
    return session;
  }

  const resolvedConfig =
    config || (await getRuntimeConfig({ allowMissingTable: true }));
  if (!resolvedConfig.luma_api_key) {
    return session;
  }

  const guestLookup = await getLumaGuest({
    apiKey: resolvedConfig.luma_api_key,
    eventApiId: session.event_api_id,
    attendeeEmail: normalizeEmailAddress(session.attendee_email),
  }).catch(() => null);

  const guestLookupRecord = asRecord(guestLookup);
  if (!guestLookupRecord) {
    return session;
  }

  return attachGuestLookupToRegisteredSession(session, guestLookupRecord);
}

export async function syncAcceptedSessionRegistration(
  session: CheckoutSession,
  config?: RuntimeConfigRecord,
) {
  if (!["detected", "confirmed"].includes(session.status) || hasGuestLookup(session)) {
    return session;
  }

  const resolvedConfig =
    config || (await getRuntimeConfig({ allowMissingTable: true }));
  if (!resolvedConfig.luma_api_key) {
    return session;
  }

  const guestLookup = await getLumaGuest({
    apiKey: resolvedConfig.luma_api_key,
    eventApiId: session.event_api_id,
    attendeeEmail: normalizeEmailAddress(session.attendee_email),
  }).catch(() => null);

  const guestLookupRecord = asRecord(guestLookup);
  if (asRecord(guestLookupRecord?.guest) && guestLookupRecord) {
    return attachGuestLookupToRegisteredSession(session, guestLookupRecord);
  }

  if (recentRegistrationAttempt(session)) {
    return session;
  }

  if (
    (session.registration_status === "pending" ||
      session.registration_status === "failed") &&
    !isRegistrationRetryDue(session)
  ) {
    return session;
  }

  return registerAcceptedSession(session, resolvedConfig);
}

export async function createCheckoutSession(input: CreateCheckoutInput) {
  const config = await getRuntimeConfig();
  const lumaApiKey = requireLumaApiKey(config);

  if (!config.api_key) {
    throw new Error("CipherPay API key is not configured. Save it on the admin page first.");
  }

  const event = await getLumaEventById(lumaApiKey, input.event_api_id);
  if (!event) {
    throw new Error("That Luma event was not found.");
  }

  const ticketTypes = await listLumaTicketTypes(lumaApiKey, event.api_id).catch(
    () => [],
  );
  const requestedTicket = input.ticket_type_api_id
    ? ticketTypes.find((ticket) => ticket.api_id === input.ticket_type_api_id) ||
      null
    : null;

  if (input.ticket_type_api_id && !requestedTicket) {
    throw new Error("The selected ticket type was not found.");
  }

  const selectedTicket = requestedTicket || ticketTypes[0] || null;
  if (!selectedTicket) {
    throw new Error("This event does not currently expose any active Luma ticket types.");
  }

  if (selectedTicket.amount == null || !selectedTicket.currency) {
    throw new Error(
      "The selected Luma ticket type does not expose a fixed price, so this app cannot create a CipherPay invoice for it.",
    );
  }

  const amount = selectedTicket.amount;
  const currency = selectedTicket.currency;
  const size = selectedTicket.name || null;
  const productName = event.name;

  const existingSession = await findLatestSessionForAttendee({
    attendeeEmail: input.attendee_email,
    eventApiId: event.api_id,
    ticketTypeApiId: selectedTicket.api_id,
  });

  if (
    existingSession &&
    existingSession.registration_status !== "failed" &&
    existingSession.status !== "expired" &&
    existingSession.status !== "refunded" &&
    (!existingSession.cipherpay_expires_at ||
      new Date(existingSession.cipherpay_expires_at).getTime() > Date.now())
  ) {
    logEvent("info", "checkout.reused", {
      session_id: existingSession.session_id,
      invoice_id: existingSession.cipherpay_invoice_id,
      attendee_email: existingSession.attendee_email,
      event_api_id: existingSession.event_api_id,
    });
    return {
      config,
      event,
      ticket: selectedTicket,
      session: existingSession,
      invoice: {
        invoice_id: existingSession.cipherpay_invoice_id,
        memo_code: existingSession.cipherpay_memo_code,
        payment_address: existingSession.cipherpay_payment_address,
        zcash_uri: existingSession.cipherpay_zcash_uri,
        price_zec: existingSession.cipherpay_price_zec,
        expires_at: existingSession.cipherpay_expires_at,
        checkout_url: existingSession.checkout_url,
        status: existingSession.status,
        detected_txid: existingSession.last_txid,
        detected_at: existingSession.detected_at,
        confirmed_at: existingSession.confirmed_at,
        refunded_at: existingSession.refunded_at,
      },
    };
  }

  const { invoice, checkout_url } = await createCipherPayInvoice(config, {
    amount,
    currency,
    product_name: productName,
    size,
  });

  const timestamp = nowIso();
  const session: CheckoutSession = {
    session_id: invoice.invoice_id,
    network: config.network,
    event_api_id: event.api_id,
    event_name: event.name,
    ticket_type_api_id: selectedTicket.api_id,
    ticket_type_name: selectedTicket.name,
    attendee_name: input.attendee_name,
    attendee_email: input.attendee_email,
    amount,
    currency,
    pricing_source: "luma",
    checkout_url,
    cipherpay_invoice_id: invoice.invoice_id,
    cipherpay_memo_code: invoice.memo_code,
    cipherpay_payment_address: invoice.payment_address,
    cipherpay_zcash_uri: invoice.zcash_uri,
    cipherpay_price_zec: invoice.price_zec,
    cipherpay_expires_at: invoice.expires_at,
    status: normalizeSessionStatus(invoice.status),
    registration_status: "pending",
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
    created_at: timestamp,
    updated_at: timestamp,
  };

  await putSession(session);
  logEvent("info", "checkout.created", {
    session_id: session.session_id,
    invoice_id: session.cipherpay_invoice_id,
    attendee_email: session.attendee_email,
    event_api_id: session.event_api_id,
    ticket_type_api_id: session.ticket_type_api_id,
  });

  return {
    config,
    event,
    ticket: selectedTicket,
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
  timestampHeader,
  txid,
}: {
  requestBody: Record<string, unknown>;
  eventType: string | null;
  invoiceId: string | null;
  signatureValid: boolean;
  validationError: string | null;
  requestHeaders: Record<string, unknown>;
  timestampHeader: string | null;
  txid: string | null;
}) {
  const receivedAt = nowIso();

  await putWebhookEvent({
    cipherpay_invoice_id: invoiceId,
    event_type: eventType,
    txid,
    signature_valid: signatureValid,
    validation_error: validationError,
    timestamp_header: timestampHeader,
    request_body_json: requestBody,
    request_headers_json: requestHeaders,
    received_at: receivedAt,
  });
  logEvent(signatureValid ? "info" : "warn", "webhook.received", {
    invoice_id: invoiceId,
    event_type: eventType,
    txid,
    signature_valid: signatureValid,
    validation_error: validationError,
  });

  if (!signatureValid || !invoiceId) {
    return null;
  }

  const session = await getSession(invoiceId);
  if (!session) {
    logEvent("warn", "webhook.unknown_session", {
      invoice_id: invoiceId,
      event_type: eventType,
      txid,
    });
    return null;
  }

  const status = cipherPayStatusFromEvent(eventType, session.status);
  let next = await upsertSession(session.session_id, {
    status,
    last_event_type: eventType,
    last_event_at: asIsoTimestamp(requestBody.timestamp) || receivedAt,
    last_txid: txid,
    last_payload_json: requestBody,
    detected_at:
      status === "detected"
        ? asIsoTimestamp(requestBody.timestamp) || receivedAt
        : session.detected_at,
    confirmed_at:
      status === "confirmed"
        ? asIsoTimestamp(requestBody.timestamp) || receivedAt
        : session.confirmed_at,
    refunded_at:
      status === "refunded"
        ? asIsoTimestamp(requestBody.timestamp) || receivedAt
        : session.refunded_at,
  });
  logEvent("info", "webhook.applied", {
    session_id: next.session_id,
    invoice_id: next.cipherpay_invoice_id,
    event_type: eventType,
    status: next.status,
  });

  if (next.status === "detected" || next.status === "confirmed") {
    const config = await getRuntimeConfig();
    next = await registerAcceptedSession(next, config);
  }

  return next;
}

export async function retryRegistrationForSession(sessionId: string) {
  const [session, config] = await Promise.all([
    getSession(sessionId),
    getRuntimeConfig({ allowMissingTable: true }),
  ]);

  if (!session) {
    throw new Error(`Session ${sessionId} was not found.`);
  }

  if (!["detected", "confirmed"].includes(session.status)) {
    throw new Error("Only accepted sessions can be retried for registration.");
  }

  logEvent("info", "registration.retry_requested", {
    session_id: sessionId,
    invoice_id: session.cipherpay_invoice_id,
  });
  return registerAcceptedSession(session, config);
}

export async function retryDueRegistrations(limit = 10) {
  const [sessions, config] = await Promise.all([
    listSessionsNeedingRegistrationRecovery(limit),
    getRuntimeConfig({ allowMissingTable: true }),
  ]);

  const results: CheckoutSession[] = [];
  logEvent("info", "registration.retry_due.started", {
    candidate_count: sessions.length,
  });
  for (const session of sessions) {
    results.push(await registerAcceptedSession(session, config));
  }

  logEvent("info", "registration.retry_due.completed", {
    recovered_count: results.length,
  });

  return results;
}
