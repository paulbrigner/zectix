import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeCalendarConnection,
  makeEventMirror,
  makeTenant,
  makeTicketMirror,
} from "@/tests/test-helpers";

const mockGetCalendarConnectionBySlug = vi.fn();
const mockGetEventMirror = vi.fn();
const mockGetTenant = vi.fn();
const mockGetTicketMirror = vi.fn();
const mockListEventMirrorsByCalendar = vi.fn();
const mockListTicketMirrorsByEvent = vi.fn();

vi.mock("@/lib/app-state/state", () => ({
  getCalendarConnectionBySlug: mockGetCalendarConnectionBySlug,
  getEventMirror: mockGetEventMirror,
  getTenant: mockGetTenant,
  getTicketMirror: mockGetTicketMirror,
  listEventMirrorsByCalendar: mockListEventMirrorsByCalendar,
  listTicketMirrorsByEvent: mockListTicketMirrorsByEvent,
}));

const { getPublicEventPageData } = await import("@/lib/public/public-calendars");

beforeEach(() => {
  mockGetCalendarConnectionBySlug.mockReset();
  mockGetEventMirror.mockReset();
  mockGetTenant.mockReset();
  mockGetTicketMirror.mockReset();
  mockListEventMirrorsByCalendar.mockReset();
  mockListTicketMirrorsByEvent.mockReset();
});

describe("getPublicEventPageData", () => {
  it("returns only eligible tickets for the public event page", async () => {
    const tenant = makeTenant();
    const calendar = makeCalendarConnection({ slug: "demo-calendar", status: "active" });
    const event = makeEventMirror({
      calendar_connection_id: calendar.calendar_connection_id,
      event_api_id: "event_123",
      sync_status: "active",
      zcash_enabled: true,
    });
    const eligibleTicket = makeTicketMirror({
      event_api_id: event.event_api_id,
      ticket_type_api_id: "ticket_enabled",
      name: "Standard",
      active: true,
      zcash_enabled: true,
    });
    const unavailableTicket = makeTicketMirror({
      event_api_id: event.event_api_id,
      ticket_type_api_id: "ticket_hidden",
      name: "VIP",
      active: true,
      zcash_enabled: false,
      zcash_enabled_reason: "This ticket tier is not currently enabled for managed Zcash checkout.",
    });
    const inactiveTicket = makeTicketMirror({
      event_api_id: event.event_api_id,
      ticket_type_api_id: "ticket_inactive",
      name: "Door",
      active: false,
      zcash_enabled: false,
    });

    mockGetCalendarConnectionBySlug.mockResolvedValue(calendar);
    mockGetTenant.mockResolvedValue(tenant);
    mockListEventMirrorsByCalendar.mockResolvedValue([event]);
    mockGetEventMirror.mockResolvedValue(event);
    mockListTicketMirrorsByEvent.mockResolvedValue([
      eligibleTicket,
      unavailableTicket,
      inactiveTicket,
    ]);

    const result = await getPublicEventPageData(calendar.slug, event.event_api_id);

    expect(result?.tickets.map((ticket) => ticket.ticket_type_api_id)).toEqual([
      "ticket_enabled",
    ]);
  });
});
