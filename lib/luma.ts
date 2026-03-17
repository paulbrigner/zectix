import { asBoolean, asFiniteNumber, asRecord, asString } from "@/lib/test-harness/utils";

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

function normalizeEventEntry(value: unknown): LumaEvent | null {
  const item = asRecord(value);
  const event = asRecord(item?.event);
  const apiId = asString(event?.api_id) || asString(item?.api_id);
  const name = asString(event?.name);
  const startAt = asString(event?.start_at);

  if (!apiId || !name || !startAt) return null;

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
  if (!item) return null;

  const ticket = asRecord(item.ticket_type) || item;
  const apiId = asString(ticket.api_id) || asString(ticket.id) || asString(item.api_id);
  const name = asString(ticket.name) || asString(item.name);
  if (!apiId || !name) return null;

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
  const response = await fetch(
    "https://public-api.luma.com/v1/calendar/list-events",
    {
      headers: {
        accept: "application/json",
        "x-luma-api-key": apiKey,
      },
      cache: "no-store",
    },
  );

  const payload = (await readJsonOrThrow(response)) as LumaEventsResponse;

  return (payload.entries || [])
    .map(normalizeEventEntry)
    .filter(Boolean) as LumaEvent[];
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
    .filter((ticket): ticket is LumaTicketType => Boolean(ticket && ticket.active));
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
  const response = await fetch("https://public-api.luma.com/v1/event/add-guests", {
    method: "POST",
    headers: lumaHeaders(apiKey),
    body: JSON.stringify({
      event_api_id: eventApiId,
      guests: [
        {
          name: attendeeName,
          email: attendeeEmail,
        },
      ],
      ticket: ticketTypeApiId
        ? {
            event_ticket_type_id: ticketTypeApiId,
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
  const response = await fetch(
    `https://public-api.luma.com/v1/event/get-guest?event_api_id=${encodeURIComponent(eventApiId)}&email=${encodeURIComponent(attendeeEmail)}`,
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
