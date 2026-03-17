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
} from "@/lib/test-harness/state";
import type {
  CipherPaySessionStatus,
  TestConfigRecord,
  TestSession,
} from "@/lib/test-harness/types";
import {
  asIsoTimestamp,
  asRecord,
  cipherPayStatusFromEvent,
  nowIso,
} from "@/lib/test-harness/utils";

type CreateCheckoutInput = {
  attendee_email: string;
  attendee_name: string;
  event_api_id: string;
  ticket_type_api_id: string | null;
};

function requireLumaApiKey(config: TestConfigRecord) {
  if (!config.luma_api_key) {
    throw new Error("Luma API key is not configured. Save it on the Test Admin page first.");
  }

  return config.luma_api_key;
}

function normalizeSessionStatus(status: CipherPaySessionStatus) {
  return status === "unknown" ? "pending" : status;
}

function hasGuestLookup(session: TestSession) {
  const registration = asRecord(session.luma_registration_json);
  const guestLookup = asRecord(registration?.guest_lookup);
  return Boolean(asRecord(guestLookup?.guest));
}

function visitStrings(
  value: unknown,
  keys: string[],
  seen = new Set<unknown>(),
): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (seen.has(value)) {
    return null;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = visitStrings(entry, keys, seen);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const direct = record[key];
    if (typeof direct === "string" && direct.trim().length > 0) {
      return direct.trim();
    }
  }

  for (const nested of Object.values(record)) {
    const match = visitStrings(nested, keys, seen);
    if (match) {
      return match;
    }
  }

  return null;
}

function extractLumaWebhookDetails(payload: Record<string, unknown>) {
  const data = asRecord(payload.data);
  const event = asRecord(data?.event) || asRecord(payload.event);
  const guest = asRecord(data?.guest);
  const ticket = asRecord(data?.event_ticket) || asRecord(payload.event_ticket);

  return {
    eventType:
      visitStrings(payload, ["type", "event_type"]) || "ticket.registered",
    eventApiId:
      (event && typeof event.api_id === "string" ? event.api_id : null) ||
      visitStrings(payload, ["event_api_id"]),
    attendeeEmail:
      (guest && typeof guest.user_email === "string" ? guest.user_email : null) ||
      (guest && typeof guest.email === "string" ? guest.email : null) ||
      (data && typeof data.user_email === "string" ? data.user_email : null) ||
      (data && typeof data.email === "string" ? data.email : null) ||
      visitStrings(payload, ["user_email", "email"]),
    ticketTypeApiId:
      (ticket && typeof ticket.event_ticket_type_id === "string"
        ? ticket.event_ticket_type_id
        : null) || visitStrings(payload, ["event_ticket_type_id", "ticket_type_api_id"]),
    registeredAt: asIsoTimestamp(
      visitStrings(payload, ["registered_at", "created_at", "timestamp"]),
    ),
  };
}

async function registerAcceptedSession(
  session: TestSession,
  config: TestConfigRecord,
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
  session: TestSession,
  config?: TestConfigRecord,
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
    throw new Error("CipherPay API key is not configured. Save it on the Test Admin page first.");
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

  const { invoice, checkout_url } = await createCipherPayInvoice(config, {
    amount,
    currency,
    product_name: productName,
    size,
  });

  const timestamp = nowIso();
  const session: TestSession = {
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

export async function processLumaTicketRegisteredWebhook({
  requestBody,
}: {
  requestBody: Record<string, unknown>;
}) {
  const details = extractLumaWebhookDetails(requestBody);
  if (!details.eventApiId || !details.attendeeEmail) {
    return null;
  }

  let session =
    (await findLatestSessionForAttendee({
      attendeeEmail: details.attendeeEmail,
      eventApiId: details.eventApiId,
      ticketTypeApiId: details.ticketTypeApiId,
    })) ||
    (details.ticketTypeApiId
      ? await findLatestSessionForAttendee({
          attendeeEmail: details.attendeeEmail,
          eventApiId: details.eventApiId,
        })
      : null);

  if (!session) {
    return null;
  }

  const config = await getRuntimeConfig({ allowMissingTable: true });
  const guestLookup = config.luma_api_key
    ? await getLumaGuest({
        apiKey: config.luma_api_key,
        eventApiId: session.event_api_id,
        attendeeEmail: session.attendee_email,
      }).catch(() => null)
    : null;

  const mergedRegistration = {
    ...(session.luma_registration_json || {}),
    webhook_event: requestBody,
    webhook_event_type: details.eventType,
    ...(asRecord(guestLookup) ? { guest_lookup: asRecord(guestLookup) } : {}),
  };

  session = await upsertSession(session.session_id, {
    registration_status: "registered",
    registration_error: null,
    luma_registration_json: mergedRegistration,
    registered_at:
      details.registeredAt ||
      asIsoTimestamp(
        asRecord(asRecord(guestLookup)?.guest)?.registered_at,
      ) ||
      session.registered_at ||
      nowIso(),
  });

  return hydrateRegisteredSessionGuestLookup(session, config);
}
