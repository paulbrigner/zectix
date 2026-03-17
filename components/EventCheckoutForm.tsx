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
    <form className="checkout-form" onSubmit={handleSubmit}>
      <div className="checkout-form-section">
        <div>
          <h2>Attendee details</h2>
          <p className="subtle-text">
            CipherPay creates the invoice, then Luma receives the registration
            once the Zcash payment is accepted.
          </p>
        </div>

        <div className="checkout-form-grid">
          <label className="test-field">
            <span>Name</span>
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
      </div>

      <div className="checkout-form-section">
        <div>
          <h2>Ticket selection</h2>
          <p className="subtle-text">
            Choose the Luma ticket type to attach after payment. CipherPay
            invoices are created directly from the fixed price returned by Luma.
          </p>
        </div>

        {ticketTypes.length ? (
          <div className="checkout-ticket-grid">
            {ticketTypes.map((ticket) => {
              const selected = selectedTicketId === ticket.api_id;

              return (
                <label
                  className={`checkout-ticket-option${selected ? " checkout-ticket-option-selected" : ""}`}
                  key={ticket.api_id}
                >
                  <input
                    checked={selected}
                    name="ticket"
                    onChange={() => setSelectedTicketId(ticket.api_id)}
                    type="radio"
                    value={ticket.api_id}
                  />
                  <div>
                    <p className="checkout-ticket-name">{ticket.name}</p>
                    <p className="subtle-text">
                      {ticketPriceLabel(ticket)}
                    </p>
                    {ticket.description ? (
                      <p className="subtle-text">{ticket.description}</p>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="checkout-banner">
            <strong>No ticket types were returned for this event.</strong>
            <p className="subtle-text">
              CipherPay checkout is unavailable until Luma exposes at least one
              active ticket type with a fixed price for this event.
            </p>
          </div>
        )}
      </div>

      {effectiveDisabledReason ? (
        <div className="checkout-banner checkout-banner-warning">
          <strong>Checkout is not ready yet.</strong>
          <p className="subtle-text">{effectiveDisabledReason}</p>
        </div>
      ) : null}

      {error ? <p className="test-error-text">{error}</p> : null}
      {notice ? <p className="test-valid-text">{notice}</p> : null}

      <div className="checkout-submit-row">
        <button
          className="button"
          disabled={submitting || isPending || !canSubmit}
          type="submit"
        >
          {submitting || isPending ? "Creating invoice..." : "Continue to payment"}
        </button>
        <p className="subtle-text">
          The next screen stays in this app and shows the payment QR code,
          address, wallet link, and live confirmation status.
        </p>
      </div>
    </form>
  );
}
