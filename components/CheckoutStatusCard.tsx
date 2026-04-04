"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { LocalDateTime } from "@/components/LocalDateTime";
import type { CheckoutSession, EventMirror } from "@/lib/app-state/types";
import { formatFiatAmount } from "@/lib/app-state/utils";
import { appApiPath, readJsonOrThrow } from "@/lib/client-http";
import { emitEmbedEvent } from "@/lib/embed-client";

type SyncResponse = {
  session: CheckoutSession;
};

type CheckoutStatusCardProps = {
  initialSession: CheckoutSession;
  event: EventMirror | null;
  viewerToken: string | null;
  embedMode?: boolean;
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

  return "Scan the QR code, tap Open wallet, or copy the address manually.";
}

function paymentStateLabel(session: CheckoutSession) {
  if (session.registration_status === "registered") return "Payment accepted";
  if (session.registration_status === "failed") return "Registration issue";
  if (session.status === "confirmed") return "Payment confirmed";
  if (session.status === "detected") return "Payment accepted";
  if (session.status === "underpaid") return "Underpaid";
  if (session.status === "expired") return "Expired";
  if (session.status === "refunded") return "Refunded";
  if (session.status === "pending" || session.status === "draft") return "Awaiting payment";
  return session.status;
}

export function CheckoutStatusCard({
  initialSession,
  event,
  viewerToken,
  embedMode = false,
}: CheckoutStatusCardProps) {
  const [session, setSession] = useState(initialSession);
  const [copiedField, setCopiedField] = useState<string | null>(null);
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
  const attendeeName =
    (registrationGuest && typeof registrationGuest.user_name === "string"
      ? registrationGuest.user_name
      : null) || session.attendee_name;
  const attendeeEmail =
    (registrationGuest && typeof registrationGuest.user_email === "string"
      ? registrationGuest.user_email
      : null) || session.attendee_email;
  const paymentExpiryLabel = expiryCountdownLabel(
    session.cipherpay_expires_at,
    countdownNowMs,
  );
  const passReady =
    session.registration_status === "registered" && Boolean(registrationGuest);
  const shouldPoll =
    session.status === "draft" ||
    session.status === "pending" ||
    session.status === "underpaid" ||
    session.status === "detected" ||
    session.status === "unknown" ||
    (session.status === "confirmed" && session.registration_status === "pending") ||
    (session.registration_status === "registered" && !registrationGuest);

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
    if (!shouldPoll) {
      return undefined;
    }

    let cancelled = false;

    async function refreshSession() {
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

        if (!cancelled) {
          setSession(response.session);
        }
      } catch {
        // Ignore passive refresh failures and wait for the next local refresh.
      }
    }

    const timeoutId = window.setTimeout(() => {
      void refreshSession();
    }, 2500);

    const intervalId = window.setInterval(() => {
      void refreshSession();
    }, 8000);

    let expiryTimeoutId: number | undefined;
    if (!paymentAccepted && session.cipherpay_expires_at) {
      const expiresAtMs = new Date(session.cipherpay_expires_at).getTime();
      if (!Number.isNaN(expiresAtMs)) {
        const refreshDelayMs = Math.max(expiresAtMs - Date.now(), 0) + 250;
        expiryTimeoutId = window.setTimeout(() => {
          void refreshSession();
        }, refreshDelayMs);
      }
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      if (expiryTimeoutId) {
        window.clearTimeout(expiryTimeoutId);
      }
    };
  }, [
    paymentAccepted,
    session.cipherpay_expires_at,
    session.session_id,
    shouldPoll,
    viewerToken,
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
      .then((dataUrl) => {
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
        light: "#FFFFFF",
      },
    })
      .then((dataUrl) => {
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

  useEffect(() => {
    if (!copiedField) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedField(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copiedField]);

  useEffect(() => {
    if (!embedMode) {
      return;
    }

    emitEmbedEvent("checkout_state", {
      sessionId: session.session_id,
      status: session.status,
      registrationStatus: session.registration_status,
      passReady,
      paymentAccepted,
    });
  }, [
    embedMode,
    passReady,
    paymentAccepted,
    session.registration_status,
    session.session_id,
    session.status,
  ]);

  async function copyValue(value: string | null, field: string) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
    } catch {
      // Silently fail — no disruptive error toast for clipboard
    }
  }

  function buildPassDocumentHtml(includePrintButton: boolean) {
    if (!registrationGuest || !entryQrDataUrl) {
      return null;
    }

    const approvalStatus =
      typeof registrationGuest.approval_status === "string"
        ? registrationGuest.approval_status
        : "approved";
    const guestId =
      typeof registrationGuest.id === "string" ? registrationGuest.id : "pending";

    const escapedEventName = escapeHtml(session.event_name);
    const escapedTicketName = escapeHtml(lumaTicketName);
    const escapedAttendeeName = escapeHtml(attendeeName);
    const escapedAttendeeEmail = escapeHtml(attendeeEmail);
    const escapedApprovalStatus = escapeHtml(approvalStatus);
    const escapedGuestId = escapeHtml(guestId);
    const escapedAmount = escapeHtml(formatFiatAmount(session.amount, session.currency));
    const escapedRegisteredAt = escapeHtml(formatPrintDate(lumaRegisteredAt));
    const escapedSessionStatus = escapeHtml(session.status);
    const escapedRegistrationStatus = escapeHtml(session.registration_status);
    const escapedInvoiceId = escapeHtml(session.cipherpay_invoice_id);
    const escapedMemo = escapeHtml(session.cipherpay_memo_code || "not assigned yet");
    const escapedCreatedAt = escapeHtml(formatPrintDate(session.created_at));
    const escapedDetectedAt = escapeHtml(formatPrintDate(session.detected_at));
    const escapedConfirmedAt = escapeHtml(formatPrintDate(session.confirmed_at));
    const escapedEventDescription = escapeHtml(
      event?.description || "No additional event description provided.",
    );
    const escapedEventStart = escapeHtml(
      formatPrintDate(event?.start_at || session.created_at),
    );
    const escapedEventEnd = escapeHtml(formatPrintDate(event?.end_at || null));
    const escapedEventTimezone = escapeHtml(event?.timezone || "America/New_York");
    const escapedEventLocation = escapeHtml(
      event?.location_label || "Location details will be available on Luma.",
    );
    const escapedEventLocationNote = event?.location_note
      ? escapeHtml(event.location_note)
      : "";

    return `<!DOCTYPE html>
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
        ${includePrintButton ? `<div class="actions">
          <button class="print-button" onclick="window.print()">Print / Save PDF</button>
        </div>` : ""}
      </section>
    </main>
  </body>
</html>`;
  }

  function openPrintView() {
    const html = buildPassDocumentHtml(true);
    if (!html) {
      return;
    }

    const printWindow = window.open("", "_blank", "width=960,height=1100");

    if (!printWindow) {
      setCopiedField("print-error");
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  }

  function savePassFile() {
    const html = buildPassDocumentHtml(false);
    if (!html) {
      return;
    }

    const safeEventName = session.event_name
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-+|-+$/g, "") || "zec-pass";
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeEventName}-pass.html`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
    setCopiedField("pass-saved");
  }

  const clipboardSvg = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );

  const checkSvg = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  function copyIconFor(field: string) {
    return copiedField === field ? checkSvg : clipboardSvg;
  }

  return (
    <div className="status-layout">
      <div className="status-main">
        {!paymentAccepted ? (
          <section className="payment-panel">
            <p className="checkout-status-message">{statusMessage(session)}</p>

            <div className="payment-hero">
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
              <strong className="payment-amount">{zecAmountLabel(session.cipherpay_price_zec)}</strong>
              {session.amount ? (
                <span className="payment-fiat-equiv">
                  ≈ {formatFiatAmount(session.amount, session.currency)}
                </span>
              ) : null}
              <div className="payment-status-row">
                <span className="public-status-chip">
                  {(session.status === "pending" || session.status === "draft") && !invoiceExpired ? (
                    <span className="payment-pulse-dot" />
                  ) : null}
                  {paymentStateLabel(session)}
                </span>
                {paymentExpiryLabel && !invoiceExpired ? (
                  <span className="status-pill-lite">{paymentExpiryLabel}</span>
                ) : null}
              </div>
            </div>

            <div className="payment-cta-row">
              {session.cipherpay_zcash_uri ? (
                invoiceExpired ? (
                  <button className="button payment-cta-primary" disabled type="button">
                    Expired
                  </button>
                ) : (
                  <a className="button payment-cta-primary" href={session.cipherpay_zcash_uri}>
                    Open wallet
                  </a>
                )
              ) : null}
              <button
                className={`payment-copy-link${copiedField === "link" ? " payment-copy-link-ok" : ""}`}
                disabled={!session.cipherpay_zcash_uri || invoiceExpired}
                onClick={() => void copyValue(session.cipherpay_zcash_uri, "link")}
                type="button"
              >
                {copiedField === "link" ? "Copied" : "Copy payment link"}
              </button>
            </div>

            <div className="payment-key-list">
              <div className="payment-key-row">
                <div className="checkout-key-value">
                  <span>Address</span>
                  <strong
                    className={`checkout-mono${invoiceExpired ? " checkout-mono-expired" : ""}`}
                  >
                    {session.cipherpay_payment_address || "Not returned yet"}
                  </strong>
                </div>
                <button
                  className={`payment-copy-icon${copiedField === "address" ? " payment-copy-icon-ok" : ""}`}
                  disabled={!session.cipherpay_payment_address || invoiceExpired}
                  onClick={() =>
                    void copyValue(session.cipherpay_payment_address, "address")
                  }
                  title="Copy address"
                  type="button"
                >
                  {copyIconFor("address")}
                </button>
              </div>

              <div className="payment-key-row">
                <div className="checkout-key-value">
                  <span>Memo</span>
                  <strong>{session.cipherpay_memo_code || "Not assigned yet"}</strong>
                </div>
                <button
                  className={`payment-copy-icon${copiedField === "memo" ? " payment-copy-icon-ok" : ""}`}
                  disabled={!session.cipherpay_memo_code}
                  onClick={() => void copyValue(session.cipherpay_memo_code, "memo")}
                  title="Copy memo"
                  type="button"
                >
                  {copyIconFor("memo")}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="pass-shell">
            <div className="pass-head">
              <div className="pass-head-top">
                <p className="eyebrow">{passReady ? "Attendee pass" : "Payment accepted"}</p>
                <div className="pass-actions">
                  {!embedMode ? (
                    <>
                      <button
                        className="button button-secondary button-small"
                        disabled={!passReady || !entryQrDataUrl}
                        onClick={() => openPrintView()}
                        type="button"
                      >
                        Print / PDF
                      </button>
                      <button
                        className="button button-secondary button-small"
                        disabled={!passReady || !entryQrDataUrl}
                        onClick={() => savePassFile()}
                        type="button"
                      >
                        Save pass
                      </button>
                    </>
                  ) : null}
                  {event?.url ? (
                    <a
                      className="button button-secondary button-small"
                      href={event.url}
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      Open on Luma
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
                ? "Your ticket is ready. Luma will continue handling ticket delivery and event updates."
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
                        {event?.start_at ? (
                          <LocalDateTime iso={event.start_at} />
                        ) : (
                          "Event time pending"
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="pass-detail-row">
                    <span>Attendee</span>
                    <div>
                      <strong>{attendeeName}</strong>
                      <p>{attendeeEmail}</p>
                    </div>
                  </div>
                  <div className="pass-detail-row">
                    <span>Ticket tier</span>
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
      </div>

      <aside className="status-sidebar">
        <section className="checkout-receipt">
          <h2 className="checkout-receipt-heading">Order summary</h2>

          <div className="checkout-detail-group">
            <div className="checkout-key-value">
              <span>When</span>
              <strong>
                {event?.start_at ? <LocalDateTime iso={event.start_at} /> : "n/a"}
              </strong>
              {event?.end_at ? (
                <p className="subtle-text">
                  Ends <LocalDateTime iso={event.end_at} />
                </p>
              ) : null}
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

          <div className="checkout-detail-group">
            <div className="checkout-key-value">
              <span>Attendee</span>
              <strong>{attendeeName}</strong>
              <p className="subtle-text">{attendeeEmail}</p>
            </div>
            <div className="checkout-key-value">
              <span>Ticket</span>
              <strong>{session.ticket_type_name || "Luma ticket"}</strong>
              <p className="subtle-text">
                {formatFiatAmount(session.amount, session.currency)}
              </p>
              {event?.description ? (
                <p className="checkout-item-description">{event.description}</p>
              ) : null}
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
