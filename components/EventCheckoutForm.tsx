"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LumaTicketType } from "@/lib/luma";
import type { TestSession } from "@/lib/test-harness/types";
import { formatFiatAmount } from "@/lib/test-harness/utils";
import { appApiPath, readJsonOrThrow } from "@/app/(console)/client-utils";

type CheckoutResponse = {
  session: TestSession;
  invoice: {
    invoice_id: string;
    memo_code: string | null;
    payment_address: string | null;
    zcash_uri: string | null;
    price_zec: number | null;
    expires_at: string | null;
    checkout_url: string;
  };
};

type EventCheckoutFormProps = {
  eventApiId: string;
  ticketTypes: LumaTicketType[];
  checkoutEnabled: boolean;
  disabledReason: string | null;
};

function ticketPriceLabel(ticket: LumaTicketType | null) {
  if (ticket?.amount != null && ticket.currency) {
    return formatFiatAmount(ticket.amount, ticket.currency);
  }

  return "Price unavailable";
}

export function EventCheckoutForm({
  eventApiId,
  ticketTypes,
  checkoutEnabled,
  disabledReason,
}: EventCheckoutFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState(
    ticketTypes[0]?.api_id || "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedTicket =
    ticketTypes.find((ticket) => ticket.api_id === selectedTicketId) || null;
  const selectedTicketHasPrice = Boolean(
    selectedTicket && selectedTicket.amount != null && selectedTicket.currency,
  );
  const hasAnyPricedTicket = ticketTypes.some(
    (ticket) => ticket.amount != null && Boolean(ticket.currency),
  );
  const effectiveDisabledReason =
    disabledReason ||
    (!ticketTypes.length
      ? "This event does not currently expose any active Luma ticket types for checkout."
      : !hasAnyPricedTicket
        ? "None of this event's Luma ticket types expose a fixed price, so this app cannot create a CipherPay invoice."
        : selectedTicket && !selectedTicketHasPrice
          ? "Select a Luma ticket type with a fixed price before creating a checkout."
          : null);
  const canSubmit = checkoutEnabled && !effectiveDisabledReason;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setError(effectiveDisabledReason || "Checkout is not configured yet.");
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
            attendee_name: name,
            attendee_email: email,
            event_api_id: eventApiId,
            ticket_type_api_id: selectedTicket?.api_id || undefined,
          }),
        }),
      );

      setNotice(`Invoice ${response.invoice.invoice_id} created. Loading payment details...`);

      startTransition(() => {
        router.push(`/checkout/${encodeURIComponent(response.session.session_id)}`);
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
            Luma uses this information for the ticket and calendar invite.
          </p>
        </div>

        <div className="public-field-grid">
          <label className="test-field">
            <span>Full name</span>
            <input
              autoComplete="name"
              className="test-input"
              onChange={(currentEvent) => setName(currentEvent.target.value)}
              placeholder="Jordan Lee"
              required
              type="text"
              value={name}
            />
          </label>

          <label className="test-field">
            <span>Email</span>
            <input
              autoComplete="email"
              className="test-input"
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
          <h2>Tickets</h2>
          <p className="subtle-text">
            Select the ticket you want to pay for with Zcash.
          </p>
        </div>

        {ticketTypes.length ? (
          <div className="public-ticket-grid">
            {ticketTypes.map((ticket) => {
              const selected = selectedTicketId === ticket.api_id;

              return (
                <label
                  className={`public-ticket-card${selected ? " public-ticket-card-selected" : ""}`}
                  key={ticket.api_id}
                >
                  <input
                    checked={selected}
                    name="ticket"
                    onChange={() => setSelectedTicketId(ticket.api_id)}
                    type="radio"
                    value={ticket.api_id}
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
        ) : (
          <div className="checkout-banner">
            <strong>No tickets are available for this event.</strong>
            <p className="subtle-text">
              Luma must expose at least one active fixed-price ticket before
              checkout can be created.
            </p>
          </div>
        )}
      </section>

      <section className="public-section-card public-total-card">
        <div className="public-total-row">
          <div>
            <span className="public-total-label">You&apos;ll pay</span>
            <strong>{ticketPriceLabel(selectedTicket)}</strong>
          </div>
          <span className="public-status-chip">Zcash invoice</span>
        </div>
        <p className="subtle-text">
          CipherPay quotes the final ZEC amount on the next step.
        </p>

        {effectiveDisabledReason ? (
          <div className="checkout-banner checkout-banner-warning">
            <strong>Checkout is not ready yet.</strong>
            <p className="subtle-text">{effectiveDisabledReason}</p>
          </div>
        ) : null}

        {error ? <p className="test-error-text">{error}</p> : null}
        {notice ? <p className="test-valid-text">{notice}</p> : null}

        <button
          className="button"
          disabled={submitting || isPending || !canSubmit}
          type="submit"
        >
          {submitting || isPending ? "Creating invoice..." : "Continue to payment"}
        </button>
      </section>
    </form>
  );
}
