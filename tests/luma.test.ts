import { afterEach, describe, expect, it, vi } from "vitest";
import { addLumaGuest } from "@/lib/luma";

describe("luma client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends quantity when adding a ticketed guest", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    vi.stubGlobal("fetch", fetchMock);

    await addLumaGuest({
      apiKey: "luma-api-key",
      eventApiId: "evt_123",
      attendeeName: "Jordan Lee",
      attendeeEmail: "jordan@example.com",
      ticketTypeApiId: "ticket_123",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://public-api.luma.com/v1/event/add-guests",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          event_api_id: "evt_123",
          guests: [
            {
              name: "Jordan Lee",
              email: "jordan@example.com",
            },
          ],
          ticket: {
            event_ticket_type_id: "ticket_123",
            quantity: 1,
          },
        }),
      }),
    );
  });
});
