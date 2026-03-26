import { notFound } from "next/navigation";
import { setTicketAssertionsAction } from "@/app/ops/actions";
import { getTenantOpsDetail } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isFutureEvent(startAt: string) {
  const startAtMs = new Date(startAt).getTime();
  return Number.isFinite(startAtMs) && startAtMs >= Date.now();
}

export default async function TenantEventsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const detail = await getTenantOpsDetail(tenantId);
  if (!detail) {
    notFound();
  }

  const eventGroups = detail.events
    .map(({ calendar, events }) => ({
      calendar,
      events: events.filter((event) => isFutureEvent(event.start_at)),
    }))
    .filter(({ events }) => events.length > 0);

  return (
    <section className="console-section">
      <div className="console-section-header">
        <div>
          <h2>Ticket eligibility controls</h2>
          <p className="subtle-text">
            Public checkout only exposes tickets that pass automatic checks and all operator assertions.
            Only future mirrored events are shown here.
          </p>
        </div>
      </div>

      {eventGroups.length === 0 ? (
        <div className="console-detail-card">
          <h3>No future events</h3>
          <p className="subtle-text">
            Ticket assertions only appear for mirrored events whose start time is still in
            the future.
          </p>
        </div>
      ) : null}

      {eventGroups.map(({ calendar, events }) => (
        <section className="console-content" key={calendar.calendar_connection_id}>
          <h3>{calendar.display_name}</h3>
          {events.map((event) => (
            <article className="console-detail-card" key={event.event_api_id}>
              <h3>{event.name}</h3>
              <p className="subtle-text">
                Event public status: {event.zcash_enabled ? "enabled" : "hidden"} · {event.zcash_enabled_reason || "No reason recorded"}
              </p>
              <div className="console-card-grid">
                {(detail.tickets_by_event.get(event.event_api_id) || []).map((ticket) => (
                  <form action={setTicketAssertionsAction} className="console-detail-card" key={ticket.ticket_type_api_id}>
                    <input name="event_api_id" type="hidden" value={ticket.event_api_id} />
                    <input name="ticket_type_api_id" type="hidden" value={ticket.ticket_type_api_id} />
                    <input name="redirect_to" type="hidden" value={`/ops/tenants/${tenantId}/events`} />
                    <h4>{ticket.name}</h4>
                    <p className="subtle-text">
                      Auto checks: {ticket.automatic_eligibility_status} · {ticket.automatic_eligibility_reasons.join(" ")}
                    </p>
                    <label className="console-field">
                      <span>
                        <input defaultChecked={ticket.confirmed_fixed_price} name="confirmed_fixed_price" type="checkbox" />
                        {" "}Confirm fixed price
                      </span>
                    </label>
                    <label className="console-field">
                      <span>
                        <input defaultChecked={ticket.confirmed_no_approval_required} name="confirmed_no_approval_required" type="checkbox" />
                        {" "}No approval required
                      </span>
                    </label>
                    <label className="console-field">
                      <span>
                        <input defaultChecked={ticket.confirmed_no_extra_required_questions} name="confirmed_no_extra_required_questions" type="checkbox" />
                        {" "}No extra required questions
                      </span>
                    </label>
                    <p className="subtle-text">
                      Public status: {ticket.zcash_enabled ? "enabled" : "disabled"} · {ticket.zcash_enabled_reason}
                    </p>
                    <button className="button button-secondary button-small" type="submit">
                      Save assertions
                    </button>
                  </form>
                ))}
              </div>
            </article>
          ))}
        </section>
      ))}
    </section>
  );
}
