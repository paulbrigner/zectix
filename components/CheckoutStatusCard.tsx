"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { CheckoutSession, EventMirror } from "@/lib/app-state/types";
import { formatFiatAmount } from "@/lib/app-state/utils";
import { appApiPath, readJsonOrThrow } from "@/lib/client-http";

type SyncResponse = {
  session: CheckoutSession;
};

type CheckoutStatusCardProps = {
  initialSession: CheckoutSession;
  event: EventMirror | null;
  viewerToken: string | null;
};

function readRegistrationGuest(value: Record<string, unknown> | null | undefined) {
  if (!value || typeof value.guest_lookup !== "object" || !value.guest_lookup) {
    return null;
  }

  const guestLookup = value.guest_lookup as Record<string, unknown>;
  if (!guestLookup.guest || typeof guestLookup.guest !== "object") {
    return null;
  }

  return guestLookup.guest as Record<string, unknown>;
}

function zecAmountLabel(priceZec: number | null) {
  if (priceZec == null) return "Quoted by CipherPay";
  return `${priceZec.toFixed(8)} ZEC`;
}

function statusLabel(session: CheckoutSession) {
  if (session.registration_status === "registered") return "Pass ready";
  if (session.registration_status === "failed") return "Registration issue";
  if (session.status === "confirmed") return "Payment confirmed";
  if (session.status === "detected") return "Payment detected";
  if (session.status === "expired") return "Invoice expired";
  if (session.status === "refunded") return "Refunded";
  if (session.status === "underpaid") return "Underpaid";
  return "Awaiting payment";
}

function statusMessage(session: CheckoutSession) {
  if (session.registration_status === "registered") {
    return "Your payment was accepted and the attendee pass is attached below.";
  }

  if (session.registration_status === "failed") {
    return (
      session.registration_error ||
      "Payment was accepted, but registration needs operator follow-up."
    );
  }

  if (session.status === "confirmed" || session.status === "detected") {
    return "Payment was seen. Registration is being finalized in the background.";
  }

  if (session.status === "expired") {
    return "This invoice expired before payment confirmed.";
  }

  if (session.status === "underpaid") {
    return "CipherPay marked the invoice as underpaid. Please review the payment details below.";
  }

  return "Send the exact amount shown below using the QR code or your wallet.";
}

export function CheckoutStatusCard({
  initialSession,
  event,
  viewerToken,
}: CheckoutStatusCardProps) {
  const [session, setSession] = useState(initialSession);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [entryQrDataUrl, setEntryQrDataUrl] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const registrationGuest = readRegistrationGuest(session.luma_registration_json);
  const entryQrUrl =
    registrationGuest && typeof registrationGuest.check_in_qr_code === "string"
      ? registrationGuest.check_in_qr_code
      : null;
  const shouldPoll =
    session.status === "pending" ||
    session.status === "draft" ||
    session.status === "underpaid" ||
    session.status === "detected" ||
    session.status === "confirmed" ||
    (session.registration_status === "pending" &&
      session.status !== "expired" &&
      session.status !== "refunded");

  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  useEffect(() => {
    if (!session.cipherpay_zcash_uri) {
      setQrCodeDataUrl(null);
      return;
    }

    let canceled = false;
    void QRCode.toDataURL(session.cipherpay_zcash_uri, {
      width: 300,
      margin: 1,
    }).then((url) => {
      if (!canceled) {
        setQrCodeDataUrl(url);
      }
    });

    return () => {
      canceled = true;
    };
  }, [session.cipherpay_zcash_uri]);

  useEffect(() => {
    if (!entryQrUrl) {
      setEntryQrDataUrl(null);
      return;
    }

    let canceled = false;
    void QRCode.toDataURL(entryQrUrl, {
      width: 240,
      margin: 1,
    }).then((url) => {
      if (!canceled) {
        setEntryQrDataUrl(url);
      }
    });

    return () => {
      canceled = true;
    };
  }, [entryQrUrl]);

  useEffect(() => {
    if (!shouldPoll) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const response = await readJsonOrThrow<SyncResponse>(
          await fetch(
            appApiPath(
              `/api/sessions/${encodeURIComponent(session.session_id)}${viewerToken ? `?t=${encodeURIComponent(viewerToken)}` : ""}`,
            ),
            {
              cache: "no-store",
            },
          ),
        );
        setSession(response.session);
      } catch {
        // Ignore passive refresh failures and try again on the next poll.
      }
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [session.session_id, shouldPoll, viewerToken]);

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyNotice(`${label} copied.`);
      window.setTimeout(() => setCopyNotice(null), 2400);
    } catch {
      setCopyNotice(`Unable to copy ${label.toLowerCase()} on this device.`);
    }
  }

  return (
    <div className="console-content">
      <section className="console-section">
        <div className="checkout-status-header">
          <div>
            <p className="eyebrow">Checkout status</p>
            <h2>{statusLabel(session)}</h2>
            <p className="subtle-text">{statusMessage(session)}</p>
          </div>
          <span className="public-status-chip">{session.status}</span>
        </div>

        <div className="console-card-grid">
          <article className="console-detail-card">
            <p className="console-kpi-label">Event</p>
            <p className="console-kpi-value" style={{ fontSize: "1.4rem" }}>
              {session.event_name}
            </p>
            <p className="subtle-text">
              {event?.start_at
                ? new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(event.start_at))
                : "Schedule from mirrored Luma event"}
            </p>
          </article>

          <article className="console-detail-card">
            <p className="console-kpi-label">Ticket</p>
            <p className="console-kpi-value" style={{ fontSize: "1.4rem" }}>
              {session.ticket_type_name}
            </p>
            <p className="subtle-text">
              {formatFiatAmount(session.amount, session.currency)} billed via CipherPay
            </p>
          </article>

          <article className="console-detail-card">
            <p className="console-kpi-label">Invoice</p>
            <p className="console-kpi-value" style={{ fontSize: "1.2rem" }}>
              {session.cipherpay_invoice_id}
            </p>
            <p className="subtle-text">{zecAmountLabel(session.cipherpay_price_zec)}</p>
          </article>
        </div>

        {copyNotice ? <p className="console-valid-text">{copyNotice}</p> : null}
      </section>

      <section className="console-section">
        <div className="public-section-head">
          <h2>Payment details</h2>
          <p className="subtle-text">
            Send the exact invoice amount. The page refreshes automatically while the invoice is active.
          </p>
        </div>

        <div className="console-card-grid">
          <article className="console-detail-card">
            <p className="console-kpi-label">Address</p>
            <p>{session.cipherpay_payment_address || "Waiting for invoice details"}</p>
            {session.cipherpay_payment_address ? (
              <button
                className="button button-secondary button-small"
                onClick={() =>
                  copyValue(session.cipherpay_payment_address as string, "Address")
                }
                type="button"
              >
                Copy address
              </button>
            ) : null}
          </article>

          <article className="console-detail-card">
            <p className="console-kpi-label">Memo</p>
            <p>{session.cipherpay_memo_code || "No memo code supplied"}</p>
            {session.cipherpay_memo_code ? (
              <button
                className="button button-secondary button-small"
                onClick={() => copyValue(session.cipherpay_memo_code as string, "Memo code")}
                type="button"
              >
                Copy memo
              </button>
            ) : null}
          </article>

          <article className="console-detail-card">
            <p className="console-kpi-label">Status</p>
            <p>{statusLabel(session)}</p>
            <p className="subtle-text">
              {session.cipherpay_expires_at
                ? `Expires ${new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(session.cipherpay_expires_at))}`
                : "Expiry pending from CipherPay"}
            </p>
          </article>
        </div>

        {qrCodeDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="CipherPay invoice QR code"
            className="checkout-qr-image"
            src={qrCodeDataUrl}
          />
        ) : null}
      </section>

      {session.registration_status === "registered" ? (
        <section className="console-section">
          <div className="public-section-head">
            <h2>Registered pass</h2>
            <p className="subtle-text">
              This attendee record was created in Luma after the CipherPay payment confirmed.
            </p>
          </div>

          <div className="console-card-grid">
            <article className="console-detail-card">
              <p className="console-kpi-label">Attendee</p>
              <p>{session.attendee_name}</p>
              <p className="subtle-text">{session.attendee_email}</p>
            </article>

            <article className="console-detail-card">
              <p className="console-kpi-label">Registered at</p>
              <p>
                {session.registered_at
                  ? new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(session.registered_at))
                  : "Recorded in Luma"}
              </p>
            </article>
          </div>

          {entryQrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Luma entry pass QR code"
              className="checkout-entry-qr-image"
              src={entryQrDataUrl}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
