"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LocalDateTime } from "@/components/LocalDateTime";
import { appApiPath, readJsonOrThrow } from "@/app/(console)/client-utils";
import type { LumaEvent } from "@/lib/luma";
import type { CheckoutSession } from "@/lib/app-state/types";
import { formatFiatAmount } from "@/lib/app-state/utils";

type SyncResponse = {
  session: CheckoutSession;
};

type CheckoutStatusCardProps = {
  initialSession: CheckoutSession;
  event: LumaEvent | null;
  lumaEventUrl: string | null;
  viewerToken: string | null;
};

function readRegistrationGuest(value: Record<string, unknown> | null | undefined) {
  if (!value) return null;
  const candidate = value.guest_lookup;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const guest = (candidate as Record<string, unknown>).guest;
  if (!guest || typeof guest !== "object" || Array.isArray(guest)) {
    return null;
  }

  return guest as Record<string, unknown>;
}

function zecAmountLabel(priceZec: number | null) {
  if (priceZec == null) return "Quoted by CipherPay after invoice creation";
  return `${priceZec.toFixed(8)} ZEC`;
}

function expiryCountdownLabel(value: string | null, nowMs: number) {
  if (!value) return null;

  const expiresAtMs = new Date(value).getTime();
  if (Number.isNaN(expiresAtMs)) {
    return null;
  }

  const remainingMs = expiresAtMs - nowMs;
  if (remainingMs <= 0) {
    return "Expired";
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `Expires in ${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  if (minutes > 0) {
    return `Expires in ${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `Expires in ${seconds}s`;
}

function formatPrintDate(value: string | null) {
  if (!value) return "Processing";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function statusMessage(session: CheckoutSession) {
  if (session.registration_status === "registered") {
    return "Your payment was accepted and your attendee pass is ready.";
  }

  if (session.registration_status === "failed") {
    return (
      session.registration_error ||
      "Your payment was accepted, but the Luma attendee record still needs operator attention."
    );
  }

  if (session.status === "confirmed") {
    return "Your payment is confirmed. Preparing the attendee pass now.";
  }

  if (session.status === "detected") {
    return "Your payment has been accepted. Creating your Luma ticket now.";
  }

  if (session.status === "underpaid") {
    return "The payment is marked as underpaid. Use the details below to send the remaining balance.";
  }

  if (session.status === "expired") {
    return "This invoice expired before payment was confirmed.";
  }

  if (session.status === "refunded") {
    return "This invoice was refunded in CipherPay.";
  }

  return "Send the exact amount below using the QR code, copied address, or wallet button.";
}

function paymentStateLabel(session: CheckoutSession) {
  if (session.registration_status === "registered") return "Payment accepted";
  if (session.registration_status === "failed") return "Registration issue";
  if (session.status === "confirmed") return "Payment confirmed";
  if (session.status === "detected") return "Payment accepted";
  if (session.status === "underpaid") return "Underpaid";
  if (session.status === "expired") return "Expired";
  if (session.status === "refunded") return "Refunded";
  if (session.status === "pending") return "Awaiting payment";
  if (session.status === "draft") return "Awaiting payment";
  return session.status;
}

export function CheckoutStatusCard({
  initialSession,
  event,
  lumaEventUrl,
  viewerToken,
}: CheckoutStatusCardProps) {
  const showCheckoutSessionPanel = false;
  const [session, setSession] = useState(initialSession);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [entryQrDataUrl, setEntryQrDataUrl] = useState<string | null>(null);
  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now());
  const paymentAccepted =
    session.status === "detected" ||
    session.status === "confirmed" ||
    session.registration_status === "registered" ||
    session.registration_status === "failed";
  const invoiceExpired = session.status === "expired";
  const registrationGuest = readRegistrationGuest(session.luma_registration_json);
  const checkInQrUrl =
    registrationGuest && typeof registrationGuest.check_in_qr_code === "string"
      ? registrationGuest.check_in_qr_code
      : null;
  const registeredTicket =
    registrationGuest &&
    registrationGuest.event_ticket &&
    typeof registrationGuest.event_ticket === "object" &&
    !Array.isArray(registrationGuest.event_ticket)
      ? (registrationGuest.event_ticket as Record<string, unknown>)
      : null;
  const lumaTicketName =
    (registeredTicket && typeof registeredTicket.name === "string"
      ? registeredTicket.name
      : null) ||
    session.ticket_type_name ||
    "Registered ticket";
  const lumaRegisteredAt =
    (registrationGuest && typeof registrationGuest.registered_at === "string"
      ? registrationGuest.registered_at
      : null) || session.registered_at;
  const paymentExpiryLabel = useMemo(
    () => expiryCountdownLabel(session.cipherpay_expires_at, countdownNowMs),
    [countdownNowMs, session.cipherpay_expires_at],
  );
  const passReady =
    session.registration_status === "registered" && Boolean(registrationGuest);

  const shouldPoll = useMemo(() => {
    const awaitingPayment =
      session.status === "draft" ||
      session.status === "pending" ||
      session.status === "underpaid" ||
      session.status === "detected" ||
      session.status === "unknown";
    const awaitingRegistration =
      session.status === "confirmed" && session.registration_status === "pending";
    const awaitingGuestPass =
      session.registration_status === "registered" && !registrationGuest;

    return awaitingPayment || awaitingRegistration || awaitingGuestPass;
  }, [registrationGuest, session.registration_status, session.status]);

  const refreshSession = useCallback(async () => {
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
      // Ignore passive refresh failures and wait for the next local refresh.
    }
  }, [session.session_id, viewerToken]);

  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  useEffect(() => {
    if (paymentAccepted || !session.cipherpay_expires_at) {
      return undefined;
    }

    setCountdownNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setCountdownNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [paymentAccepted, session.cipherpay_expires_at]);

  useEffect(() => {
    if (!shouldPoll) return undefined;

    const timeoutId = window.setTimeout(() => {
      void refreshSession();
    }, 2500);

    const intervalId = window.setInterval(() => {
      void refreshSession();
    }, 8000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [refreshSession, session.session_id, shouldPoll]);

  useEffect(() => {
    if (paymentAccepted || !session.cipherpay_expires_at) {
      return undefined;
    }

    const expiresAtMs = new Date(session.cipherpay_expires_at).getTime();
    if (Number.isNaN(expiresAtMs)) {
      return undefined;
    }

    const refreshDelayMs = Math.max(expiresAtMs - Date.now(), 0) + 250;
    const timeoutId = window.setTimeout(() => {
      void refreshSession();
    }, refreshDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    paymentAccepted,
    refreshSession,
    session.cipherpay_expires_at,
  ]);

  useEffect(() => {
    if (!session.cipherpay_zcash_uri) {
      setQrCodeDataUrl(null);
      return undefined;
    }

    let cancelled = false;

    void QRCode.toDataURL(session.cipherpay_zcash_uri, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: {
        dark: "#111827",
        light: "#FFFFFF",
      },
    })
      .then((dataUrl: string) => {
        if (!cancelled) {
          setQrCodeDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrCodeDataUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session.cipherpay_zcash_uri]);

  useEffect(() => {
    if (!checkInQrUrl) {
      setEntryQrDataUrl(null);
      return undefined;
    }

    let cancelled = false;

    void QRCode.toDataURL(checkInQrUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((dataUrl: string) => {
        if (!cancelled) {
          setEntryQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEntryQrDataUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [checkInQrUrl]);

  const copyValue = useCallback(async (value: string | null, label: string) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopyNotice(`${label} copied.`);
    } catch {
      setCopyNotice(`Could not copy ${label.toLowerCase()}.`);
    }
  }, []);

  const openPrintView = useCallback(() => {
    if (!registrationGuest || !entryQrDataUrl) return;

    const attendeeName =
      (typeof registrationGuest.user_name === "string"
        ? registrationGuest.user_name
        : null) || session.attendee_name;
    const attendeeEmail =
      (typeof registrationGuest.user_email === "string"
        ? registrationGuest.user_email
        : null) || session.attendee_email;
    const approvalStatus =
      typeof registrationGuest.approval_status === "string"
        ? registrationGuest.approval_status
        : "approved";
    const guestId =
      typeof registrationGuest.id === "string" ? registrationGuest.id : "pending";
    const printWindow = window.open("", "_blank", "width=960,height=1100");

    if (!printWindow) {
      setCopyNotice("Could not open print view.");
      return;
    }

    const escapedEventName = escapeHtml(session.event_name);
    const escapedTicketName = escapeHtml(lumaTicketName);
    const escapedAttendeeName = escapeHtml(attendeeName);
    const escapedAttendeeEmail = escapeHtml(attendeeEmail);
    const escapedApprovalStatus = escapeHtml(approvalStatus);
    const escapedGuestId = escapeHtml(guestId);
    const escapedAmount = escapeHtml(
      formatFiatAmount(session.amount, session.currency),
    );
    const escapedRegisteredAt = escapeHtml(formatPrintDate(lumaRegisteredAt));
    const escapedSessionStatus = escapeHtml(session.status);
    const escapedRegistrationStatus = escapeHtml(session.registration_status);
    const escapedInvoiceId = escapeHtml(session.cipherpay_invoice_id);
    const escapedMemo = escapeHtml(session.cipherpay_memo_code || "not assigned yet");
    const escapedCreatedAt = escapeHtml(formatPrintDate(session.created_at));
    const escapedDetectedAt = escapeHtml(formatPrintDate(session.detected_at));
    const escapedConfirmedAt = escapeHtml(formatPrintDate(session.confirmed_at));
    const escapedEventDescription = escapeHtml(event?.description || "No additional event description provided.");
    const escapedEventStart = escapeHtml(formatPrintDate(event?.start_at || session.created_at));
    const escapedEventEnd = escapeHtml(formatPrintDate(event?.end_at || null));
    const escapedEventTimezone = escapeHtml(event?.timezone || "America/New_York");
    const escapedEventLocation = escapeHtml(event?.location_label || "Location details will be available on Luma.");
    const escapedEventLocationNote = event?.location_note
      ? escapeHtml(event.location_note)
      : "";

    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Luma Entry Pass</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: Inter, system-ui, sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }
      .sheet {
        max-width: 760px;
        margin: 0 auto;
        padding: 32px 24px 48px;
      }
      .pass {
        border: 1px solid #cbd5e1;
        border-radius: 24px;
        background: white;
        padding: 24px;
        margin-bottom: 20px;
      }
      .eyebrow {
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #166534;
      }
      h1 {
        margin: 0 0 20px;
        font-size: 28px;
        line-height: 1.1;
      }
      h2 {
        margin: 0 0 16px;
        font-size: 24px;
        line-height: 1.15;
      }
      .qr {
        display: block;
        width: min(100%, 320px);
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        margin: 0 0 16px;
      }
      .note {
        margin: 0 0 24px;
        color: #475569;
        line-height: 1.5;
      }
      .session-grid,
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .session-grid {
        margin-top: 8px;
      }
      .item span {
        display: block;
        margin-bottom: 6px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #64748b;
      }
      .item strong,
      .item p {
        margin: 0;
        overflow-wrap: anywhere;
      }
      .item p {
        margin-top: 4px;
        color: #475569;
      }
      .divider {
        height: 1px;
        margin: 18px 0 20px;
        background: #e2e8f0;
      }
      .actions {
        margin-top: 20px;
      }
      .print-button {
        display: inline-block;
        padding: 10px 16px;
        border-radius: 999px;
        border: 1px solid #cbd5e1;
        background: white;
        color: #0f172a;
        font-weight: 600;
        cursor: pointer;
      }
      @media print {
        body {
          background: white;
        }
        .sheet {
          padding: 0;
        }
        .pass {
          border: none;
          border-radius: 0;
          padding: 0;
        }
        .actions {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <section class="pass">
        <p class="eyebrow">Checkout Session</p>
        <h2>${escapedEventName}</h2>
        <div class="session-grid">
          <div class="item">
            <span>Attendee</span>
            <strong>${escapedAttendeeName}</strong>
            <p>${escapedAttendeeEmail}</p>
          </div>
          <div class="item">
            <span>Ticket</span>
            <strong>${escapedTicketName}</strong>
            <p>${escapedAmount}</p>
          </div>
          <div class="item">
            <span>Invoice ID</span>
            <strong>${escapedInvoiceId}</strong>
            <p>Memo ${escapedMemo}</p>
          </div>
          <div class="item">
            <span>Registration</span>
            <strong>${escapedRegistrationStatus}</strong>
            <p>Status ${escapedSessionStatus}</p>
          </div>
          <div class="item">
            <span>Created</span>
            <strong>${escapedCreatedAt}</strong>
          </div>
          <div class="item">
            <span>Detected</span>
            <strong>${escapedDetectedAt}</strong>
          </div>
          <div class="item">
            <span>Confirmed</span>
            <strong>${escapedConfirmedAt}</strong>
          </div>
        </div>
      </section>
      <section class="pass">
        <p class="eyebrow">Event Details</p>
        <h2>${escapedEventName}</h2>
        <div class="grid">
          <div class="item">
            <span>Starts</span>
            <strong>${escapedEventStart}</strong>
            <p>${escapedEventTimezone}</p>
          </div>
          <div class="item">
            <span>Ends</span>
            <strong>${escapedEventEnd}</strong>
          </div>
          <div class="item">
            <span>Location</span>
            <strong>${escapedEventLocation}</strong>
            ${escapedEventLocationNote ? `<p>${escapedEventLocationNote}</p>` : ""}
          </div>
        </div>
        <div class="divider"></div>
        <p class="note">${escapedEventDescription}</p>
      </section>
      <section class="pass">
        <p class="eyebrow">Luma Entry Pass</p>
        <h1>Payment Accepted</h1>
        <div class="divider"></div>
        <img class="qr" src="${entryQrDataUrl}" alt="Luma entry QR code" />
        <p class="note">Present this code at event check-in.</p>
        <div class="grid">
          <div class="item">
            <span>Event</span>
            <strong>${escapedEventName}</strong>
            <p>Paid via CipherPay</p>
          </div>
          <div class="item">
            <span>Ticket</span>
            <strong>${escapedTicketName}</strong>
            <p>${escapedAmount}</p>
          </div>
          <div class="item">
            <span>Entry</span>
            <strong>${escapedApprovalStatus}</strong>
            <p>Guest ID ${escapedGuestId}</p>
          </div>
          <div class="item">
            <span>Attendee</span>
            <strong>${escapedAttendeeName}</strong>
            <p>${escapedAttendeeEmail}</p>
          </div>
          <div class="item">
            <span>Registered</span>
            <strong>${escapedRegisteredAt}</strong>
          </div>
        </div>
        <div class="actions">
          <button class="print-button" onclick="window.print()">Print / Save PDF</button>
        </div>
      </section>
    </main>
  </body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
  }, [
    entryQrDataUrl,
    lumaRegisteredAt,
    lumaTicketName,
    registrationGuest,
    session.amount,
    session.attendee_email,
    session.attendee_name,
    session.cipherpay_invoice_id,
    session.cipherpay_memo_code,
    session.confirmed_at,
    session.created_at,
    session.currency,
    session.detected_at,
    session.event_name,
    event?.description,
    event?.end_at,
    event?.location_label,
    event?.location_note,
    event?.start_at,
    event?.timezone,
    session.registration_status,
    session.status,
    setCopyNotice,
  ]);

  useEffect(() => {
    if (!copyNotice) return undefined;

    const timeoutId = window.setTimeout(() => {
      setCopyNotice(null);
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyNotice]);

  return (
    <div className={`status-layout${showCheckoutSessionPanel ? "" : " status-layout-single"}`}>
      {showCheckoutSessionPanel ? (
        <div className="status-main">
          <section className="status-card">
            <div className="status-card-head">
              <div>
                <p className="eyebrow">Checkout session</p>
                <h2>{session.event_name}</h2>
              </div>
              <div className="status-badge-wrap">
                <span className="public-status-chip">{paymentStateLabel(session)}</span>
              </div>
            </div>

            <p className="checkout-status-message">{statusMessage(session)}</p>

            <div className="status-detail-grid">
              <div className="checkout-key-value">
                <span>Attendee</span>
                <strong>{session.attendee_name}</strong>
                <p className="subtle-text">{session.attendee_email}</p>
              </div>
              <div className="checkout-key-value">
                <span>Ticket</span>
                <strong>{session.ticket_type_name || "Luma ticket"}</strong>
                <p className="subtle-text">
                  {formatFiatAmount(session.amount, session.currency)}
                </p>
              </div>
              <div className="checkout-key-value">
                <span>Invoice ID</span>
                <strong className="checkout-mono">{session.cipherpay_invoice_id}</strong>
                <p className="subtle-text">
                  Memo {session.cipherpay_memo_code || "not assigned yet"}
                </p>
              </div>
              <div className="checkout-key-value">
                <span>Registration</span>
                <strong>
                  {session.registration_status === "registered"
                    ? "Ready"
                    : session.registration_status}
                </strong>
                <p className="subtle-text">
                  {session.registered_at ? (
                    <>
                      Updated <LocalDateTime iso={session.registered_at} />
                    </>
                  ) : session.registration_error ? (
                    session.registration_error
                  ) : (
                    "Waiting for payment acceptance"
                  )}
                </p>
              </div>
            </div>

            <div className="status-timeline">
              <div className="checkout-key-value">
                <span>Created</span>
                <strong>
                  {session.created_at ? <LocalDateTime iso={session.created_at} /> : "n/a"}
                </strong>
              </div>
              <div className="checkout-key-value">
                <span>Detected</span>
                <strong>
                  {session.detected_at ? <LocalDateTime iso={session.detected_at} /> : "n/a"}
                </strong>
              </div>
              <div className="checkout-key-value">
                <span>Confirmed</span>
                <strong>
                  {session.confirmed_at ? (
                    <LocalDateTime iso={session.confirmed_at} />
                  ) : (
                    "n/a"
                  )}
                </strong>
              </div>
              {!paymentAccepted ? (
                <div className="checkout-key-value">
                  <span>Invoice expires</span>
                  <strong>
                    {session.cipherpay_expires_at ? (
                      <LocalDateTime iso={session.cipherpay_expires_at} />
                    ) : (
                      "n/a"
                    )}
                  </strong>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      <aside className="status-sidebar">
        {!paymentAccepted ? (
          <section className="payment-panel">
            <div className="payment-panel-head">
              <div>
                <p className="eyebrow">Pay with Zcash</p>
                <h3>Complete your ticket purchase</h3>
              </div>
              <div className="payment-panel-meta">
                <span className="public-status-chip">{paymentStateLabel(session)}</span>
                {paymentExpiryLabel && !invoiceExpired ? (
                <span className="status-pill-lite">
                  {paymentExpiryLabel}
                </span>
                ) : null}
              </div>
            </div>

            <div className="payment-summary-row">
              <div className="checkout-key-value">
                <span>Event</span>
                <strong>{session.event_name}</strong>
              </div>
              <div className="checkout-key-value">
                <span>Ticket</span>
                <strong>{session.ticket_type_name || "Luma ticket"}</strong>
              </div>
            </div>

            <div className={`payment-qr-wrap${invoiceExpired ? " payment-qr-wrap-expired" : ""}`}>
              {qrCodeDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="Zcash payment QR code"
                  className={`checkout-qr-image${invoiceExpired ? " checkout-qr-image-expired" : ""}`}
                  src={qrCodeDataUrl}
                />
              ) : (
                <div className="checkout-qr-fallback">
                  QR code will appear once CipherPay returns the payment URI.
                </div>
              )}
              {invoiceExpired ? <div className="payment-qr-expired-overlay">Expired</div> : null}
            </div>

            <div className="payment-key-list">
              <div className="payment-key-row">
                <div className="checkout-key-value">
                  <span>Amount</span>
                  <strong>{zecAmountLabel(session.cipherpay_price_zec)}</strong>
                </div>
              </div>
              <div className="payment-key-row">
                <div className="checkout-key-value">
                  <span>Address</span>
                  <strong className={`checkout-mono${invoiceExpired ? " checkout-mono-expired" : ""}`}>
                    {session.cipherpay_payment_address || "Not returned yet"}
                  </strong>
                </div>
                <button
                  className="button button-secondary button-small"
                  disabled={!session.cipherpay_payment_address || invoiceExpired}
                  onClick={() =>
                    void copyValue(session.cipherpay_payment_address, "Payment address")
                  }
                  type="button"
                >
                  {invoiceExpired ? "Address expired" : "Copy address"}
                </button>
              </div>
            </div>

            <div className="payment-action-stack">
              {session.cipherpay_zcash_uri ? (
                invoiceExpired ? (
                  <button className="button" disabled type="button">
                    Open wallet · Expired
                  </button>
                ) : (
                  <a className="button" href={session.cipherpay_zcash_uri}>
                    Open wallet
                  </a>
                )
              ) : null}
              <button
                className="button button-secondary"
                disabled={!session.cipherpay_zcash_uri || invoiceExpired}
                onClick={() =>
                  void copyValue(session.cipherpay_zcash_uri, "Zcash URI")
                }
                type="button"
              >
                {invoiceExpired ? "Copy payment URI · Expired" : "Copy payment URI"}
              </button>
            </div>

            {copyNotice ? <p className="console-valid-text">{copyNotice}</p> : null}
          </section>
        ) : (
          <section className="pass-shell">
            <div className="pass-head">
              <div className="pass-head-top">
                <p className="eyebrow">{passReady ? "Attendee pass" : "Payment accepted"}</p>
                <div className="pass-actions">
                  <button
                    aria-label="Open printer-friendly pass"
                    className="checkout-print-button"
                    disabled={!passReady || !entryQrDataUrl}
                    onClick={() => void openPrintView()}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      fill="none"
                      height="18"
                      viewBox="0 0 24 24"
                      width="18"
                    >
                      <path
                        d="M7 9V4h10v5M7 14H5a2 2 0 0 1-2-2v-1.5A2.5 2.5 0 0 1 5.5 8h13A2.5 2.5 0 0 1 21 10.5V12a2 2 0 0 1-2 2h-2M7 12h10v8H7v-8Z"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.7"
                      />
                      <circle cx="17.5" cy="10.5" fill="currentColor" r="1" />
                    </svg>
                  </button>
                  {lumaEventUrl ? (
                    <a
                      className="button button-secondary button-small"
                      href={lumaEventUrl}
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      Open event
                    </a>
                  ) : null}
                </div>
              </div>
              <h3>
                {passReady
                  ? "You're in"
                  : session.registration_status === "failed"
                    ? "Registration needs attention"
                    : "Preparing your pass"}
              </h3>
            </div>

            <div className="pass-banner">
              {passReady
                ? "Your ticket is ready. Luma will email your ticket and calendar invite."
                : session.registration_status === "failed"
                  ? (session.registration_error ||
                    "Payment accepted, but Luma did not create the attendee record yet.")
                  : "Payment accepted. We're attaching your Luma attendee pass now. This page refreshes automatically."}
            </div>

            {passReady && registrationGuest ? (
              <div className="pass-grid">
                <div className="pass-qr-card">
                  {entryQrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt="Luma entry QR code"
                      className="checkout-qr-image"
                      src={entryQrDataUrl}
                    />
                  ) : (
                    <div className="checkout-qr-fallback">
                      Luma check-in QR will appear here as soon as it is available.
                    </div>
                  )}
                  <p className="subtle-text">Entry QR</p>
                </div>

                <div className="pass-detail-list">
                  <div className="pass-detail-row">
                    <span>Event</span>
                    <div>
                      <strong>{session.event_name}</strong>
                      <p>
                        {event?.start_at ? <LocalDateTime iso={event.start_at} /> : "Event time pending"}
                      </p>
                    </div>
                  </div>
                  <div className="pass-detail-row">
                    <span>Attendee</span>
                    <div>
                      <strong>
                        {(typeof registrationGuest.user_name === "string"
                          ? registrationGuest.user_name
                          : null) || session.attendee_name}
                      </strong>
                      <p>
                        {(typeof registrationGuest.user_email === "string"
                          ? registrationGuest.user_email
                          : null) || session.attendee_email}
                      </p>
                    </div>
                  </div>
                  <div className="pass-detail-row">
                    <span>Ticket</span>
                    <div>
                      <strong>{lumaTicketName}</strong>
                      <p>Paid with Zcash</p>
                    </div>
                  </div>
                  <div className="pass-detail-row">
                    <span>Entry status</span>
                    <div>
                      <strong>
                        {typeof registrationGuest.approval_status === "string"
                          ? registrationGuest.approval_status
                          : "approved"}
                      </strong>
                      <p>
                        Guest ID{" "}
                        {typeof registrationGuest.id === "string"
                          ? registrationGuest.id
                          : "pending"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pass-loading-card">
                <strong>Preparing your pass</strong>
                <p className="subtle-text">
                  {session.registration_status === "failed"
                    ? (session.registration_error ||
                      "Payment has been accepted, but the Luma attendee record still needs operator attention.")
                    : "Payment has been accepted. The Luma guest record is still being attached."}
                </p>
              </div>
            )}
          </section>
        )}

        <section className="status-card">
          <p className="eyebrow">Event details</p>
          <h2>Event details</h2>
          <div className="status-detail-grid">
            <div className="checkout-key-value">
              <span>Starts</span>
              <strong>
                {event?.start_at ? <LocalDateTime iso={event.start_at} /> : "n/a"}
              </strong>
              <p className="subtle-text">{event?.timezone || "America/New_York"}</p>
            </div>
            <div className="checkout-key-value">
              <span>Ends</span>
              <strong>
                {event?.end_at ? <LocalDateTime iso={event.end_at} /> : "n/a"}
              </strong>
            </div>
            <div className="checkout-key-value">
              <span>Location</span>
              <strong>
                {event?.location_label || "View the Luma event for venue details"}
              </strong>
              {event?.location_note ? (
                <p className="subtle-text">{event.location_note}</p>
              ) : null}
            </div>
          </div>
          <p className="checkout-status-message">
            {event?.description ||
              "Event logistics will remain available on the Luma event page."}
          </p>
        </section>
      </aside>
    </div>
  );
}
