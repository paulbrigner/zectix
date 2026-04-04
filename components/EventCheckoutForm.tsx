"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CheckoutSession, TicketMirror } from "@/lib/app-state/types";
import { formatFiatAmount } from "@/lib/app-state/utils";
import { appApiPath, readJsonOrThrow } from "@/lib/client-http";
import { emitEmbedEvent } from "@/lib/embed-client";

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
  embedMode?: boolean;
  embedParentOrigin?: string | null;
  embedParentToken?: string | null;
};

function ticketPriceLabel(ticket: TicketMirror | null) {
  return formatFiatAmount(ticket?.amount || null, ticket?.currency || null);
}

export function EventCheckoutForm({
  calendarSlug,
  eventApiId,
  ticketTypes,
  embedMode = false,
  embedParentOrigin = null,
  embedParentToken = null,
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
      if (embedMode) {
        emitEmbedEvent("checkout_created", {
          calendarSlug,
          eventApiId,
          invoiceId: response.invoice.invoice_id,
          sessionId: response.session.session_id,
        });
      }

      startTransition(() => {
        const params = new URLSearchParams();
        if (response.viewer_token) {
          params.set("t", response.viewer_token);
        }
        if (embedMode) {
          params.set("embed", "1");
          if (embedParentToken) {
            params.set("et", embedParentToken);
          }
          if (embedParentOrigin) {
            params.set("po", embedParentOrigin);
          }
        }

        const query = params.toString();
        const nextUrl =
          `/checkout/${encodeURIComponent(response.session.session_id)}` +
          (query ? `?${query}` : "");
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
            For your event pass and attendee record.
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
          <h2>Select a ticket</h2>
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

      </section>

      <section className="public-section-card public-total-card">
        <div className="public-total-row">
          <span className="public-total-label">Total</span>
          <strong>{ticketPriceLabel(selectedTicket)}</strong>
        </div>

        <p className="subtle-text">
          You&apos;ll see the exact ZEC amount on the payment screen.
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
