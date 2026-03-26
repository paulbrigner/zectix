import {
  asBoolean,
  asFiniteNumber,
  asRecord,
  asString,
  normalizeEmailAddress,
} from "@/lib/app-state/utils";

export type LumaEvent = {
  api_id: string;
  name: string;
  start_at: string;
  end_at: string | null;
  timezone: string | null;
  description: string | null;
  cover_url: string | null;
  url: string | null;
  location_label: string | null;
  location_note: string | null;
};

export type LumaTicketType = {
  api_id: string;
  name: string;
  currency: string | null;
  amount: number | null;
  active: boolean;
  description: string | null;
  price_source: "amount" | "fallback";
};

export const LUMA_MANAGED_EVENT_WEBHOOK_TYPES = [
  "event.created",
  "event.updated",
  "event.canceled",
] as const;

export type LumaWebhookStatus = "active" | "paused";

export type LumaWebhook = {
  id: string;
  url: string;
  event_types: string[];
  status: LumaWebhookStatus;
  secret: string | null;
  created_at: string | null;
};

export type LumaWebhookListResponse = {
  entries: LumaWebhook[];
  has_more: boolean;
  next_cursor: string | null;
};

type LumaEventsResponse = {
  entries?: Array<{
    api_id?: string;
    event?: {
      api_id?: string;
      name?: string;
      start_at?: string;
      end_at?: string;
      timezone?: string;
      description?: string;
      cover_url?: string;
      url?: string;
      geo_address_json?: {
        full_address?: string;
        description?: string;
      } | null;
    };
  }>;
};

type LumaWebhookListPayload = {
  entries?: unknown[];
  has_more?: boolean;
  next_cursor?: string;
};

function normalizeEventEntry(value: unknown): LumaEvent | null {
  const item = asRecord(value);
  const event = asRecord(item?.event);
  const apiId = asString(event?.api_id) || asString(item?.api_id);
  const name = asString(event?.name);
  const startAt = asString(event?.start_at);

  if (!apiId || !name || !startAt) {
    return null;
  }

  return {
    api_id: apiId,
    name,
    start_at: startAt,
    end_at: asString(event?.end_at),
    timezone: asString(event?.timezone),
    description: asString(event?.description),
    cover_url: asString(event?.cover_url),
    url: asString(event?.url),
    location_label: asString(asRecord(event?.geo_address_json)?.full_address),
    location_note: asString(asRecord(event?.geo_address_json)?.description),
  };
}

function normalizeTicketType(value: unknown): LumaTicketType | null {
  const item = asRecord(value);
  if (!item) {
    return null;
  }

  const ticket = asRecord(item.ticket_type) || item;
  const apiId = asString(ticket.api_id) || asString(ticket.id) || asString(item.api_id);
  const name = asString(ticket.name) || asString(item.name);
  if (!apiId || !name) {
    return null;
  }

  const amount =
    (() => {
      const cents =
        asFiniteNumber(ticket.cents) ??
        asFiniteNumber(ticket.min_cents) ??
        asFiniteNumber(item.cents) ??
        asFiniteNumber(item.min_cents);
      return cents != null ? cents / 100 : null;
    })() ??
    asFiniteNumber(ticket.amount) ??
    asFiniteNumber(ticket.price) ??
    asFiniteNumber(asRecord(ticket.price_data)?.amount) ??
    asFiniteNumber(asRecord(item.price_data)?.amount);

  const currency =
    asString(ticket.currency)?.toUpperCase() ??
    asString(asRecord(ticket.price_data)?.currency)?.toUpperCase() ??
    asString(item.currency)?.toUpperCase() ??
    null;

  return {
    api_id: apiId,
    name,
    currency,
    amount,
    active: !asBoolean(ticket.is_hidden) && asBoolean(ticket.active, true),
    description: asString(ticket.description) || asString(item.description),
    price_source: amount == null ? "fallback" : "amount",
  };
}

function normalizeLumaWebhook(value: unknown): LumaWebhook | null {
  const item = asRecord(value);
  const id = asString(item?.id) || asString(item?.webhook_id);
  const url = asString(item?.url);
  if (!id || !url) {
    return null;
  }

  const eventTypes = Array.isArray(item?.event_types)
    ? item.event_types
        .map((entry) => asString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];

  return {
    id,
    url,
    event_types: eventTypes,
    status: item?.status === "paused" ? "paused" : "active",
    secret: asString(item?.secret),
    created_at: asString(item?.created_at),
  };
}

async function readJsonOrThrow(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Luma request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

function lumaHeaders(apiKey: string) {
  return {
    accept: "application/json",
    "content-type": "application/json",
    "x-luma-api-key": apiKey,
  };
}

export async function listLumaEvents(apiKey: string) {
  const response = await fetch("https://public-api.luma.com/v1/calendar/list-events", {
    headers: {
      accept: "application/json",
      "x-luma-api-key": apiKey,
    },
    cache: "no-store",
  });

  const payload = (await readJsonOrThrow(response)) as LumaEventsResponse;

  return (payload.entries || [])
    .map(normalizeEventEntry)
    .filter((entry): entry is LumaEvent => Boolean(entry));
}

export async function getLumaEventById(apiKey: string, eventApiId: string) {
  const events = await listLumaEvents(apiKey);
  return events.find((event) => event.api_id === eventApiId) || null;
}

export async function listLumaTicketTypes(apiKey: string, eventApiId: string) {
  const response = await fetch(
    `https://public-api.luma.com/v1/event/ticket-types/list?event_api_id=${encodeURIComponent(eventApiId)}`,
    {
      headers: {
        accept: "application/json",
        "x-luma-api-key": apiKey,
      },
      cache: "no-store",
    },
  );

  const payload = await readJsonOrThrow(response);
  const item = asRecord(payload);
  const entries = Array.isArray(item?.ticket_types)
    ? item.ticket_types
    : Array.isArray(item?.entries)
      ? item.entries
      : [];

  return entries
    .map(normalizeTicketType)
    .filter((ticket): ticket is LumaTicketType => Boolean(ticket && ticket.active))
    .sort((left, right) => {
      const leftAmount = left.amount;
      const rightAmount = right.amount;

      if (leftAmount == null && rightAmount == null) return 0;
      if (leftAmount == null) return 1;
      if (rightAmount == null) return -1;
      return rightAmount - leftAmount;
    });
}

export async function addLumaGuest({
  apiKey,
  eventApiId,
  attendeeName,
  attendeeEmail,
  ticketTypeApiId,
}: {
  apiKey: string;
  eventApiId: string;
  attendeeName: string;
  attendeeEmail: string;
  ticketTypeApiId: string | null;
}) {
  const normalizedEmail = normalizeEmailAddress(attendeeEmail);
  const response = await fetch("https://public-api.luma.com/v1/event/add-guests", {
    method: "POST",
    headers: lumaHeaders(apiKey),
    body: JSON.stringify({
      event_api_id: eventApiId,
      guests: [
        {
          name: attendeeName,
          email: normalizedEmail,
        },
      ],
      ticket: ticketTypeApiId
        ? {
            event_ticket_type_id: ticketTypeApiId,
            quantity: 1,
          }
        : undefined,
    }),
    cache: "no-store",
  });

  return readJsonOrThrow(response);
}

export async function getLumaGuest({
  apiKey,
  eventApiId,
  attendeeEmail,
}: {
  apiKey: string;
  eventApiId: string;
  attendeeEmail: string;
}) {
  const normalizedEmail = normalizeEmailAddress(attendeeEmail);
  const response = await fetch(
    `https://public-api.luma.com/v1/event/get-guest?event_api_id=${encodeURIComponent(eventApiId)}&email=${encodeURIComponent(normalizedEmail)}`,
    {
      headers: {
        accept: "application/json",
        "x-luma-api-key": apiKey,
      },
      cache: "no-store",
    },
  );

  return readJsonOrThrow(response);
}

export async function listLumaWebhooks(apiKey: string, cursor?: string | null) {
  const url = new URL("https://public-api.luma.com/v1/webhooks/list");
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-luma-api-key": apiKey,
    },
    cache: "no-store",
  });

  const payload = (await readJsonOrThrow(response)) as LumaWebhookListPayload;

  return {
    entries: (payload.entries || [])
      .map(normalizeLumaWebhook)
      .filter((entry): entry is LumaWebhook => Boolean(entry)),
    has_more: asBoolean(payload.has_more),
    next_cursor: asString(payload.next_cursor),
  } satisfies LumaWebhookListResponse;
}

export async function createLumaWebhook({
  apiKey,
  url,
  eventTypes,
}: {
  apiKey: string;
  url: string;
  eventTypes: readonly string[];
}) {
  const response = await fetch("https://public-api.luma.com/v1/webhooks/create", {
    method: "POST",
    headers: lumaHeaders(apiKey),
    body: JSON.stringify({
      url,
      event_types: eventTypes,
    }),
    cache: "no-store",
  });

  const payload = await readJsonOrThrow(response);
  const webhook =
    normalizeLumaWebhook(asRecord(payload)?.webhook) || normalizeLumaWebhook(payload);
  if (!webhook) {
    throw new Error("Luma webhook creation did not return a valid webhook payload.");
  }

  return webhook;
}

export async function updateLumaWebhook({
  apiKey,
  id,
  eventTypes,
  status = "active",
}: {
  apiKey: string;
  id: string;
  eventTypes?: readonly string[];
  status?: LumaWebhookStatus;
}) {
  const response = await fetch("https://public-api.luma.com/v1/webhooks/update", {
    method: "POST",
    headers: lumaHeaders(apiKey),
    body: JSON.stringify({
      id,
      ...(eventTypes ? { event_types: eventTypes } : {}),
      status,
    }),
    cache: "no-store",
  });

  const payload = await readJsonOrThrow(response);
  const webhook =
    normalizeLumaWebhook(asRecord(payload)?.webhook) || normalizeLumaWebhook(payload);
  if (!webhook) {
    return null;
  }

  return webhook;
}

export async function deleteLumaWebhook({
  apiKey,
  id,
}: {
  apiKey: string;
  id: string;
}) {
  const response = await fetch("https://public-api.luma.com/v1/webhooks/delete", {
    method: "POST",
    headers: lumaHeaders(apiKey),
    body: JSON.stringify({
      id,
    }),
    cache: "no-store",
  });

  return readJsonOrThrow(response);
}
