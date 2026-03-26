import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createCalendarConnectionAction,
  createCipherPayConnectionAction,
  setTenantStatusAction,
  validateAndSyncCalendarAction,
  validateCipherPayConnectionAction,
} from "@/app/ops/actions";
import { getTenantOpsDetail } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const detail = await getTenantOpsDetail(tenantId);
  if (!detail) {
    notFound();
  }

  const calendarNamesById = new Map(
    detail.calendars.map((calendar) => [
      calendar.calendar_connection_id,
      calendar.display_name,
    ]),
  );

  return (
    <>
      <section className="console-section">
        <div className="console-section-header">
          <div>
            <p className="eyebrow">{detail.tenant.status}</p>
            <h2>{detail.tenant.name}</h2>
            <p className="subtle-text">
              {detail.tenant.contact_email} · {detail.tenant.service_fee_bps} bps service fee · minimum {detail.tenant.monthly_minimum_usd_cents} cents
            </p>
          </div>
          <div className="button-row">
            <Link className="button button-secondary button-small" href={`/ops/tenants/${encodeURIComponent(detail.tenant.tenant_id)}/dashboard`}>
              Dashboard
            </Link>
            <Link className="button button-secondary button-small" href={`/ops/tenants/${encodeURIComponent(detail.tenant.tenant_id)}/events`}>
              Ticket controls
            </Link>
            <Link className="button button-secondary button-small" href={`/ops/tenants/${encodeURIComponent(detail.tenant.tenant_id)}/recovery`}>
              Recovery
            </Link>
          </div>
        </div>

        <form action={setTenantStatusAction} className="console-content">
          <input name="tenant_id" type="hidden" value={detail.tenant.tenant_id} />
          <input name="redirect_to" type="hidden" value={`/ops/tenants/${detail.tenant.tenant_id}`} />
          <div className="public-field-grid">
            <label className="console-field">
              <span>Tenant status</span>
              <select
                className="console-input"
                defaultValue={detail.tenant.status}
                name="status"
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="archived">archived</option>
              </select>
            </label>
          </div>
          <p className="subtle-text">
            Public calendar pages only resolve for tenants whose status is <code>active</code>.
          </p>
          <button className="button button-secondary button-small" type="submit">
            Save tenant status
          </button>
        </form>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Add calendar connection</h2>
            <p className="subtle-text">Store the organizer’s Luma key as a secret reference, then validate and sync mirrored inventory.</p>
          </div>
        </div>

        <form action={createCalendarConnectionAction} className="console-content">
          <input name="tenant_id" type="hidden" value={detail.tenant.tenant_id} />
          <input name="redirect_to" type="hidden" value={`/ops/tenants/${detail.tenant.tenant_id}`} />
          <div className="public-field-grid">
            <label className="console-field">
              <span>Display name</span>
              <input className="console-input" name="display_name" required type="text" />
            </label>
            <label className="console-field">
              <span>Public slug</span>
              <input className="console-input" name="slug" type="text" />
            </label>
            <label className="console-field">
              <span>Luma API key</span>
              <input className="console-input" name="luma_api_key" required type="password" />
            </label>
            <label className="console-field">
              <span>Luma webhook secret</span>
              <input className="console-input" name="luma_webhook_secret" type="password" />
            </label>
            <label className="console-field">
              <span>Luma webhook id</span>
              <input className="console-input" name="luma_webhook_id" type="text" />
            </label>
          </div>
          <button className="button" type="submit">
            Save calendar connection
          </button>
        </form>

        <div className="console-card-grid">
          {detail.calendars.map((calendar) => {
            const previews = detail.calendar_secret_previews.get(calendar.calendar_connection_id);
            return (
              <article className="console-detail-card" key={calendar.calendar_connection_id}>
                <p className="console-kpi-label">{calendar.status}</p>
                <h3>{calendar.display_name}</h3>
                <p className="subtle-text">Public URL: /c/{calendar.slug}</p>
                <p className="subtle-text">
                  Luma key {previews?.luma.preview || "missing"} · webhook {previews?.lumaWebhook.preview || "not set"}
                </p>
                <p className="subtle-text">
                  Last sync {calendar.last_synced_at || "not yet"} {calendar.last_sync_error ? `· ${calendar.last_sync_error}` : ""}
                </p>
                <form action={validateAndSyncCalendarAction}>
                  <input name="calendar_connection_id" type="hidden" value={calendar.calendar_connection_id} />
                  <input name="redirect_to" type="hidden" value={`/ops/tenants/${detail.tenant.tenant_id}`} />
                  <button className="button button-secondary button-small" type="submit">
                    Validate and sync
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Add CipherPay connection</h2>
            <p className="subtle-text">
              Attach one organizer-owned payment account to one calendar connection.
              Saving for a calendar that already has a CipherPay connection will replace
              the current secrets and endpoints on that connection instead of creating a
              second live checkout mapping.
            </p>
          </div>
        </div>

        <form action={createCipherPayConnectionAction} className="console-content">
          <input name="tenant_id" type="hidden" value={detail.tenant.tenant_id} />
          <input name="redirect_to" type="hidden" value={`/ops/tenants/${detail.tenant.tenant_id}`} />
          <div className="public-field-grid">
            <label className="console-field">
              <span>Calendar connection</span>
              <select className="console-input" name="calendar_connection_id" required>
                <option value="">Select calendar</option>
                {detail.calendars.map((calendar) => (
                  <option key={calendar.calendar_connection_id} value={calendar.calendar_connection_id}>
                    {calendar.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="console-field">
              <span>Network</span>
              <select className="console-input" name="network" required>
                <option value="testnet">testnet</option>
                <option value="mainnet">mainnet</option>
              </select>
            </label>
            <label className="console-field">
              <span>API base URL</span>
              <input className="console-input" name="api_base_url" type="text" />
            </label>
            <label className="console-field">
              <span>Checkout base URL</span>
              <input className="console-input" name="checkout_base_url" type="text" />
            </label>
            <label className="console-field">
              <span>CipherPay API key</span>
              <input className="console-input" name="cipherpay_api_key" required type="password" />
            </label>
            <label className="console-field">
              <span>CipherPay webhook secret</span>
              <input className="console-input" name="cipherpay_webhook_secret" required type="password" />
            </label>
          </div>
          <button className="button" type="submit">
            Save CipherPay connection
          </button>
        </form>

        <div className="console-card-grid">
          {detail.cipherpay_connections.map((connection) => {
            const previews = detail.cipherpay_secret_previews.get(connection.cipherpay_connection_id);
            const activeConnection = detail.active_cipherpay_connections_by_calendar.get(
              connection.calendar_connection_id,
            );
            const isCurrentConnection =
              activeConnection?.cipherpay_connection_id === connection.cipherpay_connection_id;
            const calendarName =
              calendarNamesById.get(connection.calendar_connection_id) || "Unknown calendar";
            return (
              <article className="console-detail-card" key={connection.cipherpay_connection_id}>
                <p className="console-kpi-label">
                  {connection.status} · {isCurrentConnection ? "current" : "historical"}
                </p>
                <h3>{connection.network}</h3>
                <p className="subtle-text">{calendarName}</p>
                <p className="subtle-text">{connection.api_base_url}</p>
                <p className="subtle-text">
                  API {previews?.api.preview || "missing"} · webhook {previews?.webhook.preview || "missing"}
                </p>
                {isCurrentConnection ? (
                  <form action={validateCipherPayConnectionAction}>
                    <input name="cipherpay_connection_id" type="hidden" value={connection.cipherpay_connection_id} />
                    <input name="redirect_to" type="hidden" value={`/ops/tenants/${detail.tenant.tenant_id}`} />
                    <button className="button button-secondary button-small" type="submit">
                      Mark validated
                    </button>
                  </form>
                ) : (
                  <p className="subtle-text">
                    This saved row is not the connection currently used for checkout.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
