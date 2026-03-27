"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CheckoutSession, TicketMirror } from "@/lib/app-state/types";
import { formatFiatAmount } from "@/lib/app-state/utils";
import { appApiPath, readJsonOrThrow } from "@/lib/client-http";

type CheckoutResponse = {
  session: CheckoutSession;
  viewer_token: string | null;
  invoice: {
    invoice_id: string;
    checkout_url: string | null;
  };
};

type EventCheckoutFormProps = {
  calendarSlug: string;
  eventApiId: string;
  ticketTypes: TicketMirror[];
  unavailableTicketTypes?: TicketMirror[];
};

function ticketPriceLabel(ticket: TicketMirror | null) {
  return formatFiatAmount(ticket?.amount || null, ticket?.currency || null);
}

function unavailableTicketReason(ticket: TicketMirror) {
  if (!ticket.active) {
    return "This ticket tier is not currently active on the Luma event.";
  }

  return (
    ticket.zcash_enabled_reason ||
    ticket.automatic_eligibility_reasons[0] ||
    "This ticket tier is not currently available for managed Zcash checkout."
  );
}

export function EventCheckoutForm({
  calendarSlug,
  eventApiId,
  ticketTypes,
  unavailableTicketTypes = [],
}: EventCheckoutFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState(
    ticketTypes[0]?.ticket_type_api_id || "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedTicket =
    ticketTypes.find((ticket) => ticket.ticket_type_api_id === selectedTicketId) ||
    null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTicket) {
      setError("Select a Zcash-enabled ticket before continuing.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await readJsonOrThrow<CheckoutResponse>(
        await fetch(appApiPath("/api/checkout"), {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            calendar_slug: calendarSlug,
            attendee_name: name,
            attendee_email: email,
            event_api_id: eventApiId,
            ticket_type_api_id: selectedTicket.ticket_type_api_id,
          }),
        }),
      );

      setNotice(`Invoice ${response.invoice.invoice_id} is ready. Loading payment details...`);

      startTransition(() => {
        const nextUrl = response.viewer_token
          ? `/checkout/${encodeURIComponent(response.session.session_id)}?t=${encodeURIComponent(response.viewer_token)}`
          : `/checkout/${encodeURIComponent(response.session.session_id)}`;
        router.push(nextUrl);
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create checkout session",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="public-checkout-form" onSubmit={handleSubmit}>
      <section className="public-section-card">
        <div className="public-section-head">
          <h2>Attendee</h2>
          <p className="subtle-text">
            Luma will use this information for the attendee record and event entry pass.
          </p>
        </div>

        <div className="public-field-grid">
          <label className="console-field">
            <span>Full name</span>
            <input
              autoComplete="name"
              className="console-input"
              onChange={(currentEvent) => setName(currentEvent.target.value)}
              placeholder="Jordan Lee"
              required
              type="text"
              value={name}
            />
          </label>

          <label className="console-field">
            <span>Email</span>
            <input
              autoComplete="email"
              className="console-input"
              onChange={(currentEvent) => setEmail(currentEvent.target.value)}
              placeholder="jordan@example.com"
              required
              type="email"
              value={email}
            />
          </label>
        </div>
      </section>

      <section className="public-section-card">
        <div className="public-section-head">
          <h2>Eligible tickets</h2>
          <p className="subtle-text">
            These tickets passed the managed-service checks and were explicitly enabled by ops.
          </p>
        </div>

        <div className="public-ticket-grid">
          {ticketTypes.map((ticket) => {
            const selected = selectedTicketId === ticket.ticket_type_api_id;
            return (
              <label
                className={`public-ticket-card${selected ? " public-ticket-card-selected" : ""}`}
                key={ticket.ticket_type_api_id}
              >
                <input
                  checked={selected}
                  name="ticket"
                  onChange={() => setSelectedTicketId(ticket.ticket_type_api_id)}
                  type="radio"
                  value={ticket.ticket_type_api_id}
                />
                <div className="public-ticket-card-body">
                  <div className="public-ticket-card-top">
                    <div>
                      <p className="public-ticket-status">Available now</p>
                      <p className="public-ticket-name">{ticket.name}</p>
                      {ticket.description ? (
                        <p className="subtle-text">{ticket.description}</p>
                      ) : null}
                    </div>
                    <span className="public-ticket-price">
                      {ticketPriceLabel(ticket)}
                    </span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {unavailableTicketTypes.length ? (
          <div className="public-ticket-unavailable-section">
            <div className="public-section-head">
              <h3>Other mirrored ticket tiers</h3>
              <p className="subtle-text">
                These tiers are visible from the mirrored event, but they are not currently
                available for managed Zcash checkout.
              </p>
            </div>

            <div className="public-ticket-grid">
              {unavailableTicketTypes.map((ticket) => (
                <article
                  className="public-ticket-card public-ticket-card-disabled"
                  key={ticket.ticket_type_api_id}
                >
                  <div className="public-ticket-card-body">
                    <div className="public-ticket-card-top">
                      <div>
                        <p className="public-ticket-status public-ticket-status-muted">
                          Currently unavailable
                        </p>
                        <p className="public-ticket-name">{ticket.name}</p>
                        {ticket.description ? (
                          <p className="subtle-text">{ticket.description}</p>
                        ) : null}
                      </div>
                      <span className="public-ticket-price">
                        {ticketPriceLabel(ticket)}
                      </span>
                    </div>
                    <p className="subtle-text public-ticket-unavailable-note">
                      {unavailableTicketReason(ticket)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="public-section-card public-total-card">
        <div className="public-total-row">
          <div>
            <span className="public-total-label">You&apos;ll pay</span>
            <strong>{ticketPriceLabel(selectedTicket)}</strong>
          </div>
          <span className="public-status-chip">CipherPay invoice</span>
        </div>
        <p className="subtle-text">
          The invoice quotes the final ZEC amount on the next screen.
        </p>

        {error ? <p className="console-error-text">{error}</p> : null}
        {notice ? <p className="console-valid-text">{notice}</p> : null}

        <button
          className="button"
          disabled={submitting || isPending || !selectedTicket}
          type="submit"
        >
          {submitting || isPending ? "Creating invoice..." : "Continue to payment"}
        </button>
      </section>
    </form>
  );
}
