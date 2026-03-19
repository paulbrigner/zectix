import { createHash, randomUUID } from "node:crypto";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  getDynamoDocumentClient,
  appStateTableName,
} from "@/lib/app-state/dynamodb";
import type {
  RuntimeConfigRecord,
  DashboardData,
  CheckoutSession,
  WebhookEvent,
} from "@/lib/app-state/types";
import {
  asBoolean,
  asFiniteNumber,
  asIsoTimestamp,
  asRecord,
  asString,
  defaultConfigRecord,
  normalizeEmailAddress,
  normalizeCipherPayNetwork,
  normalizeCurrencyCode,
  nowIso,
  sortByIsoDateDesc,
  toPublicConfig,
} from "@/lib/app-state/utils";
import { isExternalSecretManagementEnabled } from "@/lib/runtime-env";

const CONFIG_KEY = {
  pk: "CONFIG",
  sk: "DEFAULT",
};

function sessionKey(sessionId: string) {
  return {
    pk: "SESSION",
    sk: sessionId,
  };
}

function webhookKey(eventId: string, receivedAt: string) {
  return {
    pk: "WEBHOOK",
    sk: `${receivedAt}#${eventId}`,
  };
}

function sessionLookupPartition(eventApiId: string, attendeeEmail: string) {
  return `SESSION_LOOKUP#${eventApiId}#${normalizeEmailAddress(attendeeEmail)}`;
}

function sessionTicketLookupPartition(
  eventApiId: string,
  attendeeEmail: string,
  ticketTypeApiId: string | null | undefined,
) {
  return `${sessionLookupPartition(eventApiId, attendeeEmail)}#${ticketTypeApiId || "_"}`;
}

function sessionLookupSortKey(createdAt: string | null, sessionId: string) {
  return `${createdAt || nowIso()}#${sessionId}`;
}

function checkoutRateLimitKey(scope: string, identifier: string, windowStart: string) {
  return {
    pk: `RATE_LIMIT#${scope}#${identifier}`,
    sk: windowStart,
  };
}

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

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

function envConfigPatch(): Partial<RuntimeConfigRecord> {
  const patch: Partial<RuntimeConfigRecord> = {};

  if (process.env.CIPHERPAY_NETWORK === "mainnet") {
    patch.network = "mainnet";
  } else if (process.env.CIPHERPAY_NETWORK === "testnet") {
    patch.network = "testnet";
  }

  const apiBaseUrl = asString(process.env.CIPHERPAY_API_BASE_URL);
  if (apiBaseUrl) {
    patch.api_base_url = apiBaseUrl;
  }

  const checkoutBaseUrl = asString(process.env.CIPHERPAY_CHECKOUT_BASE_URL);
  if (checkoutBaseUrl) {
    patch.checkout_base_url = checkoutBaseUrl;
  }

  const apiKey = asString(process.env.CIPHERPAY_API_KEY);
  if (apiKey) {
    patch.api_key = apiKey;
  }

  const webhookSecret = asString(process.env.CIPHERPAY_WEBHOOK_SECRET);
  if (webhookSecret) {
    patch.webhook_secret = webhookSecret;
  }

  const lumaApiKey = asString(process.env.LUMA_API_KEY);
  if (lumaApiKey) {
    patch.luma_api_key = lumaApiKey;
  }

  return patch;
}

function normalizeConfigRecord(value: unknown): RuntimeConfigRecord {
  const item = asRecord(value);
  const envPatch = envConfigPatch();
  const fallback = defaultConfigRecord(
    normalizeCipherPayNetwork(envPatch.network),
  );
  const merged = {
    ...fallback,
    ...(item || {}),
    ...envPatch,
  };

  if (isExternalSecretManagementEnabled()) {
    merged.api_key = envPatch.api_key || null;
    merged.webhook_secret = envPatch.webhook_secret || null;
    merged.luma_api_key = envPatch.luma_api_key || null;
  }

  return {
    network: normalizeCipherPayNetwork(merged.network),
    api_base_url: asString(merged.api_base_url) || fallback.api_base_url,
    checkout_base_url:
      asString(merged.checkout_base_url) || fallback.checkout_base_url,
    api_key: asString(merged.api_key),
    webhook_secret: asString(merged.webhook_secret),
    luma_api_key: asString(merged.luma_api_key),
    created_at: asIsoTimestamp(merged.created_at),
    updated_at: asIsoTimestamp(merged.updated_at),
  };
}

function normalizeSession(value: unknown): CheckoutSession | null {
  const item = asRecord(value);
  if (!item) return null;

  const sessionId = asString(item.session_id) || asString(item.sk);
  const invoiceId = asString(item.cipherpay_invoice_id);
  const eventApiId = asString(item.event_api_id);
  const eventName = asString(item.event_name);
  const attendeeName = asString(item.attendee_name);
  const attendeeEmail = asString(item.attendee_email);
  const amount = asFiniteNumber(item.amount);
  const currency = asString(item.currency);

  if (
    !sessionId ||
    !invoiceId ||
    !eventApiId ||
    !eventName ||
    !attendeeName ||
    !attendeeEmail ||
    amount == null ||
    !currency
  ) {
    return null;
  }

  return {
    session_id: sessionId,
    network: normalizeCipherPayNetwork(item.network),
    event_api_id: eventApiId,
    event_name: eventName,
    ticket_type_api_id: asString(item.ticket_type_api_id),
    ticket_type_name: asString(item.ticket_type_name),
    attendee_name: attendeeName,
    attendee_email: attendeeEmail,
    amount,
    currency: normalizeCurrencyCode(currency),
    pricing_source: item.pricing_source === "luma" ? "luma" : "fallback",
    checkout_url: asString(item.checkout_url),
    cipherpay_invoice_id: invoiceId,
    cipherpay_memo_code: asString(item.cipherpay_memo_code),
    cipherpay_payment_address: asString(item.cipherpay_payment_address),
    cipherpay_zcash_uri: asString(item.cipherpay_zcash_uri),
    cipherpay_price_zec: asFiniteNumber(item.cipherpay_price_zec),
    cipherpay_expires_at: asIsoTimestamp(item.cipherpay_expires_at),
    status:
      asString(item.status) === "draft" ||
      asString(item.status) === "pending" ||
      asString(item.status) === "underpaid" ||
      asString(item.status) === "detected" ||
      asString(item.status) === "confirmed" ||
      asString(item.status) === "expired" ||
      asString(item.status) === "refunded"
        ? (item.status as CheckoutSession["status"])
        : "unknown",
    registration_status:
      item.registration_status === "registered"
        ? "registered"
        : item.registration_status === "failed"
          ? "failed"
          : "pending",
    registration_error: asString(item.registration_error),
    luma_registration_json: asRecord(item.luma_registration_json),
    last_event_type: asString(item.last_event_type),
    last_event_at: asIsoTimestamp(item.last_event_at),
    last_txid: asString(item.last_txid),
    last_payload_json: asRecord(item.last_payload_json),
    detected_at: asIsoTimestamp(item.detected_at),
    confirmed_at: asIsoTimestamp(item.confirmed_at),
    registered_at: asIsoTimestamp(item.registered_at),
    refunded_at: asIsoTimestamp(item.refunded_at),
    created_at: asIsoTimestamp(item.created_at),
    updated_at: asIsoTimestamp(item.updated_at),
  };
}

function normalizeWebhook(value: unknown): WebhookEvent | null {
  const item = asRecord(value);
  if (!item) return null;

  const eventId = asString(item.event_id);
  if (!eventId) return null;

  return {
    event_id: eventId,
    cipherpay_invoice_id: asString(item.cipherpay_invoice_id),
    event_type: asString(item.event_type),
    txid: asString(item.txid),
    signature_valid: asBoolean(item.signature_valid),
    validation_error: asString(item.validation_error),
    timestamp_header: asString(item.timestamp_header),
    request_body_json: asRecord(item.request_body_json),
    request_headers_json: asRecord(item.request_headers_json),
    received_at: asIsoTimestamp(item.received_at),
  };
}

async function queryAllSessions() {
  try {
    const response = await getDynamoDocumentClient().send(
      new QueryCommand({
        TableName: appStateTableName(),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": "SESSION",
        },
      }),
    );

    return sortByIsoDateDesc(
      (response.Items || []).map(normalizeSession).filter(Boolean) as CheckoutSession[],
      (item) => item.created_at,
    );
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [];
    }

    throw error;
  }
}

export async function getRuntimeConfig(options?: { allowMissingTable?: boolean }) {
  try {
    const response = await getDynamoDocumentClient().send(
      new GetCommand({
        TableName: appStateTableName(),
        Key: CONFIG_KEY,
      }),
    );

    return normalizeConfigRecord(response.Item || null);
  } catch (error) {
    if (options?.allowMissingTable) {
      return normalizeConfigRecord(null);
    }

    throw error;
  }
}

export async function updateRuntimeConfig(
  patch: Partial<RuntimeConfigRecord>,
): Promise<RuntimeConfigRecord> {
  const current = await getRuntimeConfig({ allowMissingTable: true });
  const timestamp = nowIso();
  const nextPatch = isExternalSecretManagementEnabled()
    ? {
        ...patch,
        api_key: null,
        webhook_secret: null,
        luma_api_key: null,
      }
    : patch;
  const next = normalizeConfigRecord({
    ...current,
    ...nextPatch,
    created_at: current.created_at || timestamp,
    updated_at: timestamp,
  });

  await getDynamoDocumentClient().send(
    new PutCommand({
      TableName: appStateTableName(),
      Item: {
        ...CONFIG_KEY,
        ...next,
      },
    }),
  );

  return next;
}

export async function getSession(sessionId: string) {
  const response = await getDynamoDocumentClient().send(
    new GetCommand({
      TableName: appStateTableName(),
      Key: sessionKey(sessionId),
    }),
  );

  return normalizeSession(response.Item || null);
}

export async function putSession(session: CheckoutSession) {
  const lookupSortKey = sessionLookupSortKey(session.created_at, session.session_id);
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
          pk: sessionLookupPartition(session.event_api_id, session.attendee_email),
          sk: lookupSortKey,
          session_id: session.session_id,
          ticket_type_api_id: session.ticket_type_api_id,
          created_at: session.created_at,
        },
      }),
    ),
    getDynamoDocumentClient().send(
      new PutCommand({
        TableName: appStateTableName(),
        Item: {
          pk: sessionTicketLookupPartition(
            session.event_api_id,
            session.attendee_email,
            session.ticket_type_api_id,
          ),
          sk: lookupSortKey,
          session_id: session.session_id,
          created_at: session.created_at,
        },
      }),
    ),
  ]);

  return session;
}

export async function upsertSession(
  sessionId: string,
  patch: Partial<CheckoutSession>,
): Promise<CheckoutSession> {
  const current = await getSession(sessionId);
  if (!current) {
    throw new Error(`Session ${sessionId} was not found`);
  }

  const next = normalizeSession({
    ...current,
    ...patch,
    session_id: current.session_id,
    cipherpay_invoice_id: current.cipherpay_invoice_id,
    event_api_id: current.event_api_id,
    event_name: current.event_name,
    attendee_name: current.attendee_name,
    attendee_email: current.attendee_email,
    amount: patch.amount ?? current.amount,
    currency: patch.currency ?? current.currency,
    pricing_source: patch.pricing_source ?? current.pricing_source,
    updated_at: nowIso(),
  });

  if (!next) {
    throw new Error("Session update produced an invalid session shape");
  }

  return putSession(next);
}

export async function listSessions(limit = 20) {
  const sessions = await queryAllSessions();
  return sessions.slice(0, limit);
}

async function latestSessionIdFromLookup(partition: string) {
  const response = await getDynamoDocumentClient().send(
    new QueryCommand({
      TableName: appStateTableName(),
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": partition,
      },
      Limit: 1,
      ScanIndexForward: false,
    }),
  );

  const item = asRecord(response.Items?.[0]);
  return asString(item?.session_id);
}

export async function findLatestSessionForAttendee({
  attendeeEmail,
  eventApiId,
  ticketTypeApiId,
}: {
  attendeeEmail: string;
  eventApiId: string;
  ticketTypeApiId?: string | null;
}) {
  const exactPartition = ticketTypeApiId
    ? sessionTicketLookupPartition(eventApiId, attendeeEmail, ticketTypeApiId)
    : null;
  const genericPartition = sessionLookupPartition(eventApiId, attendeeEmail);

  const exactSessionId = exactPartition
    ? await latestSessionIdFromLookup(exactPartition).catch(() => null)
    : null;
  if (exactSessionId) {
    const exactSession = await getSession(exactSessionId);
    if (exactSession) {
      return exactSession;
    }
  }

  const genericSessionId = await latestSessionIdFromLookup(genericPartition).catch(
    () => null,
  );
  if (genericSessionId) {
    const genericSession = await getSession(genericSessionId);
    if (genericSession && (!ticketTypeApiId || genericSession.ticket_type_api_id === ticketTypeApiId)) {
      return genericSession;
    }
  }

  const normalizedEmail = normalizeEmailAddress(attendeeEmail);
  const sessions = await queryAllSessions();
  return (
    sessions.find((session) => {
      if (session.event_api_id !== eventApiId) {
        return false;
      }

      if (normalizeEmailAddress(session.attendee_email) !== normalizedEmail) {
        return false;
      }

      if (ticketTypeApiId && session.ticket_type_api_id !== ticketTypeApiId) {
        return false;
      }

      return true;
    }) || null
  );
}

export async function putWebhookEvent(
  event: Omit<WebhookEvent, "event_id" | "received_at"> & {
    event_id?: string;
    received_at?: string | null;
  },
) {
  const eventId = event.event_id || randomUUID();
  const receivedAt = event.received_at || nowIso();
  const next: WebhookEvent = {
    event_id: eventId,
    cipherpay_invoice_id: event.cipherpay_invoice_id,
    event_type: event.event_type,
    txid: event.txid,
    signature_valid: event.signature_valid,
    validation_error: event.validation_error,
    timestamp_header: event.timestamp_header,
    request_body_json: event.request_body_json,
    request_headers_json: event.request_headers_json,
    received_at: receivedAt,
  };

  await getDynamoDocumentClient().send(
    new PutCommand({
      TableName: appStateTableName(),
      Item: {
        ...webhookKey(eventId, receivedAt),
        ...next,
      },
    }),
  );

  return next;
}

export async function listWebhookEvents(limit = 20) {
  try {
    const response = await getDynamoDocumentClient().send(
      new QueryCommand({
        TableName: appStateTableName(),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": "WEBHOOK",
        },
      }),
    );

    return sortByIsoDateDesc(
      (response.Items || [])
        .map(normalizeWebhook)
        .filter(Boolean) as WebhookEvent[],
      (item) => item.received_at,
    ).slice(0, limit);
  } catch (error) {
    if (isMissingLocalStateError(error)) {
      return [];
    }

    throw error;
  }
}

export async function consumeCheckoutRateLimit({
  ipAddress,
  attendeeEmail,
  eventApiId,
}: {
  ipAddress: string | null;
  attendeeEmail: string;
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
    `${normalizeEmailAddress(attendeeEmail)}#${eventApiId}`,
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

export async function getDashboardData(): Promise<DashboardData> {
  const [config, sessions, webhooks] = await Promise.all([
    getRuntimeConfig({ allowMissingTable: true }),
    listSessions(25),
    listWebhookEvents(25),
  ]);

  return {
    config: toPublicConfig(config),
    stats: {
      total_sessions: sessions.length,
      pending_sessions: sessions.filter((session) =>
        ["draft", "pending", "underpaid"].includes(session.status),
      ).length,
      detected_sessions: sessions.filter(
        (session) => session.status === "detected",
      ).length,
      confirmed_sessions: sessions.filter(
        (session) => session.status === "confirmed",
      ).length,
      expired_sessions: sessions.filter((session) =>
        ["expired", "refunded"].includes(session.status),
      ).length,
      registered_sessions: sessions.filter(
        (session) => session.registration_status === "registered",
      ).length,
      failed_registrations: sessions.filter(
        (session) => session.registration_status === "failed",
      ).length,
      invalid_webhooks: webhooks.filter((event) => !event.signature_valid).length,
    },
    sessions,
    recent_webhooks: webhooks,
  };
}
