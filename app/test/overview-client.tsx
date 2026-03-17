"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LocalDateTime } from "@/components/LocalDateTime";
import type { TestDashboardData } from "@/lib/test-harness/types";
import { formatFiatAmount } from "@/lib/test-harness/utils";
import { readJsonOrThrow, testWebhookCallbackUrl } from "@/app/test/client-utils";
import { TestStatusPill } from "@/app/test/status-pill";

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="test-kpi-card">
      <p className="test-kpi-label">{label}</p>
      <p className="test-kpi-value">{value}</p>
      <p className="subtle-text test-kpi-detail">{detail}</p>
    </article>
  );
}

export function TestOverviewClient() {
  const [data, setData] = useState<TestDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const nextData = await readJsonOrThrow<TestDashboardData>(
        await fetch("/api/test/dashboard", { cache: "no-store" }),
      );
      setData(nextData);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load test dashboard",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadDashboard();
  }, []);

  const config = data?.config;
  const sessions = data?.sessions ?? [];
  const webhooks = data?.recent_webhooks ?? [];
  const webhookUrl = origin ? testWebhookCallbackUrl(origin) : "/api/test/webhook";
  const configReady = Boolean(
    config?.has_api_key && config?.has_webhook_secret && config?.has_luma_api_key,
  );

  return (
    <div className="test-page-body">
      <section className="test-section">
        <header className="test-section-header">
          <div>
            <h2>Overview</h2>
            <p className="subtle-text">
              Shared operational view of test checkout sessions, Luma
              registrations, and incoming CipherPay webhooks.
            </p>
          </div>
          <div className="button-row">
            <button
              className="button button-secondary button-small"
              onClick={() => void loadDashboard()}
              type="button"
            >
              Refresh
            </button>
          </div>
        </header>

        {loading ? <p className="subtle-text">Loading test dashboard…</p> : null}
        {error ? <p className="test-error-text">{error}</p> : null}

        {data ? (
          <>
            <div className="test-kpi-grid">
              <StatCard
                label="Environment"
                value={config?.network === "mainnet" ? "Mainnet" : "Testnet"}
                detail={config?.api_base_url || "No API base configured yet"}
              />
              <StatCard
                label="Config"
                value={configReady ? "Ready" : "Needs setup"}
                detail={
                  configReady
                    ? "CipherPay + Luma secrets saved"
                    : "Finish setup on the Admin tab"
                }
              />
              <StatCard
                label="Tracked sessions"
                value={String(data.stats.total_sessions)}
                detail={`${data.stats.pending_sessions} pending, ${data.stats.confirmed_sessions} confirmed`}
              />
              <StatCard
                label="Registered"
                value={String(data.stats.registered_sessions)}
                detail={`${data.stats.failed_registrations} registration failures, ${data.stats.invalid_webhooks} invalid webhooks`}
              />
            </div>

            <div className="test-card-grid">
              <article className="test-detail-card">
                <h3>Webhook callback URL</h3>
                <p className="test-inline-code">{webhookUrl}</p>
                <p className="subtle-text">
                  Save this in CipherPay so confirmed invoice events post back to
                  this test harness.
                </p>
                <div className="button-row">
                  <Link className="button button-secondary button-small" href="/test/admin">
                    Open admin
                  </Link>
                </div>
              </article>

              <article className="test-detail-card">
                <h3>Stored secret previews</h3>
                <p className="subtle-text">CipherPay API key: {config?.api_key_preview || "not saved yet"}</p>
                <p className="subtle-text">Webhook secret: {config?.webhook_secret_preview || "not saved yet"}</p>
                <p className="subtle-text">Luma API key: {config?.luma_api_key_preview || "not saved yet"}</p>
              </article>
            </div>
          </>
        ) : null}
      </section>

      <section className="test-section">
        <header className="test-section-header">
          <div>
            <h2>Recent checkouts</h2>
            <p className="subtle-text">
              Latest local sessions created through the event checkout flow.
            </p>
          </div>
        </header>

        {!sessions.length && !loading ? (
          <p className="subtle-text">No local sessions yet.</p>
        ) : null}

        {sessions.length ? (
          <div className="test-table-wrap">
            <table className="test-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Attendee</th>
                  <th>Payment</th>
                  <th>Registration</th>
                  <th>Amount</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.session_id}>
                    <td>
                      <strong>{session.event_name}</strong>
                      <p className="subtle-text test-table-note">
                        {session.ticket_type_name || "No ticket label"}
                      </p>
                    </td>
                    <td>
                      <strong>{session.attendee_name}</strong>
                      <p className="subtle-text test-table-note">
                        {session.attendee_email}
                      </p>
                    </td>
                    <td>
                      <TestStatusPill status={session.status} />
                    </td>
                    <td>
                      <span
                        className={
                          session.registration_status === "registered"
                            ? "test-valid-text"
                            : session.registration_status === "failed"
                              ? "test-error-text"
                              : "subtle-text"
                        }
                      >
                        {session.registration_status}
                      </span>
                      {session.registration_error ? (
                        <p className="subtle-text test-table-note">
                          {session.registration_error}
                        </p>
                      ) : null}
                    </td>
                    <td>{formatFiatAmount(session.amount, session.currency)}</td>
                    <td>
                      {session.updated_at ? (
                        <LocalDateTime iso={session.updated_at} />
                      ) : (
                        "n/a"
                      )}
                    </td>
                    <td>
                      <Link
                        className="button button-secondary button-small"
                        href={`/checkout/${session.session_id}`}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="test-section">
        <header className="test-section-header">
          <div>
            <h2>Webhook log</h2>
            <p className="subtle-text">
              Latest callbacks received from CipherPay, including signature
              verification results.
            </p>
          </div>
        </header>

        {!webhooks.length && !loading ? (
          <p className="subtle-text">No webhook deliveries recorded yet.</p>
        ) : null}

        {webhooks.length ? (
          <div className="test-table-wrap">
            <table className="test-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Event</th>
                  <th>Invoice</th>
                  <th>Signature</th>
                  <th>TXID</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((event) => (
                  <tr key={event.event_id}>
                    <td>
                      {event.received_at ? (
                        <LocalDateTime iso={event.received_at} />
                      ) : (
                        "n/a"
                      )}
                    </td>
                    <td>{event.event_type || "unknown"}</td>
                    <td className="test-mono-cell">
                      {event.cipherpay_invoice_id || "n/a"}
                    </td>
                    <td>
                      <span
                        className={
                          event.signature_valid
                            ? "test-valid-text"
                            : "test-error-text"
                        }
                      >
                        {event.signature_valid ? "valid" : "invalid"}
                      </span>
                      {event.validation_error ? (
                        <p className="subtle-text test-table-note">
                          {event.validation_error}
                        </p>
                      ) : null}
                    </td>
                    <td className="test-mono-cell">{event.txid || "n/a"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
