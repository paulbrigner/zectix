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
  nowIso,
} from "@/lib/app-state/utils";

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

async function registerAcceptedSession(
  session: CheckoutSession,
  config: RuntimeConfigRecord,
) {
  if (session.registration_status === "registered") {
    return session;
  }

  const lumaApiKey = requireLumaApiKey(config);

  try {
    const result = await addLumaGuest({
      apiKey: lumaApiKey,
      eventApiId: session.event_api_id,
      attendeeEmail: session.attendee_email,
      attendeeName: session.attendee_name,
      ticketTypeApiId: session.ticket_type_api_id,
    });
    const guestLookup = await getLumaGuest({
      apiKey: lumaApiKey,
      eventApiId: session.event_api_id,
      attendeeEmail: session.attendee_email,
    }).catch(() => null);
    const registrationPayload = {
      ...(asRecord(result) || {}),
      ...(asRecord(guestLookup) ? { guest_lookup: asRecord(guestLookup) } : {}),
    };

    const registeredSession = await upsertSession(session.session_id, {
      registration_status: "registered",
      registration_error: null,
      luma_registration_json: registrationPayload,
      registered_at: nowIso(),
    });
    return hydrateRegisteredSessionGuestLookup(registeredSession, config);
  } catch (error) {
    return upsertSession(session.session_id, {
      registration_status: "failed",
      registration_error:
        error instanceof Error ? error.message : "Luma registration failed",
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
    attendeeEmail: session.attendee_email,
  }).catch(() => null);

  if (!asRecord(guestLookup)) {
    return session;
  }

  return upsertSession(session.session_id, {
    registration_status: "registered",
    registration_error: null,
    luma_registration_json: {
      ...(session.luma_registration_json || {}),
      guest_lookup: asRecord(guestLookup),
    },
    registered_at:
      asIsoTimestamp(asRecord(asRecord(guestLookup)?.guest)?.registered_at) ||
      session.registered_at ||
      nowIso(),
  });
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

  if (!signatureValid || !invoiceId) {
    return null;
  }

  const session = await getSession(invoiceId);
  if (!session) {
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

  if (next.status === "detected" || next.status === "confirmed") {
    const config = await getRuntimeConfig();
    next = await registerAcceptedSession(next, config);
  }

  return next;
}
