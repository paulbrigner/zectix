import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createCalendarConnectionAction,
  createCipherPayConnectionAction,
  setTenantStatusAction,
  validateAndSyncCalendarAction,
  validateCipherPayConnectionAction,
} from "@/app/ops/actions";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { ConsoleFieldLabel } from "@/components/ConsoleFieldLabel";
import { ConsoleInfoTip } from "@/components/ConsoleInfoTip";
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
  const cipherPayConnectionRows = detail.cipherpay_connections.map((connection) => {
    const previews = detail.cipherpay_secret_previews.get(
      connection.cipherpay_connection_id,
    );
    const activeConnection = detail.active_cipherpay_connections_by_calendar.get(
      connection.calendar_connection_id,
    );
    return {
      connection,
      previews,
      isCurrentConnection:
        activeConnection?.cipherpay_connection_id === connection.cipherpay_connection_id,
      calendarName:
        calendarNamesById.get(connection.calendar_connection_id) || "Unknown calendar",
    };
  });
  const currentCipherPayConnections = cipherPayConnectionRows.filter(
    (entry) => entry.isCurrentConnection,
  );
  const historicalCipherPayConnections = cipherPayConnectionRows.filter(
    (entry) => !entry.isCurrentConnection,
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
              <ConsoleFieldLabel
                info="Only active tenants resolve public calendar pages."
                label="Tenant status"
              />
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
            <h2>Calendar connection</h2>
            <p className="subtle-text">
              Store the organizer’s Luma API key. The managed event webhook is
              created internally during validation.
            </p>
          </div>
        </div>

        <ConsoleDisclosure
          defaultOpen={!detail.calendars.length}
          description="Save the Luma API key first. Validate and sync will verify access, register the managed event webhook, and refresh mirrored inventory."
          title="New calendar connection"
        >
          <form action={createCalendarConnectionAction} className="console-content">
            <input name="tenant_id" type="hidden" value={detail.tenant.tenant_id} />
            <input name="redirect_to" type="hidden" value={`/ops/tenants/${detail.tenant.tenant_id}`} />
            <div className="public-field-grid">
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Shown in ops and used as the default public label for this calendar."
                  label="Display name"
                />
                <input className="console-input" name="display_name" required type="text" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Public URL path under /c/{slug}. Leave blank to generate it from the display name and add a numeric suffix if that slug is already taken."
                  label="Public slug"
                  optional
                />
                <input className="console-input" name="slug" type="text" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Organizer-owned Luma API key used to mirror events, attach attendees after payment, and register the managed event webhook."
                  label="Luma API key"
                />
                <input className="console-input" name="luma_api_key" required type="password" />
              </label>
            </div>
            <button className="button" type="submit">
              Save calendar connection
            </button>
          </form>
        </ConsoleDisclosure>

        <div className="console-card-grid">
          {detail.calendars.map((calendar) => {
            const previews = detail.calendar_secret_previews.get(calendar.calendar_connection_id);
            return (
              <article className="console-detail-card" key={calendar.calendar_connection_id}>
                <p className="console-kpi-label">{calendar.status}</p>
                <h3>{calendar.display_name}</h3>
                <p className="subtle-text">Public URL: /c/{calendar.slug}</p>
                <p className="subtle-text">
                  Luma key {previews?.luma.preview || "missing"} · managed webhook {calendar.luma_webhook_id ? "configured" : "not configured yet"}
                </p>
                <p className="subtle-text">
                  Last sync {calendar.last_synced_at || "not yet"} {calendar.last_sync_error ? `· ${calendar.last_sync_error}` : ""}
                </p>
                <div className="console-inline-action">
                  <form action={validateAndSyncCalendarAction}>
                    <input name="calendar_connection_id" type="hidden" value={calendar.calendar_connection_id} />
                    <input name="redirect_to" type="hidden" value={`/ops/tenants/${detail.tenant.tenant_id}`} />
                    <button className="button button-secondary button-small" type="submit">
                      Validate and sync
                    </button>
                  </form>
                  <ConsoleInfoTip label="What Validate and sync does">
                    <p>
                      Checks that the saved Luma API key can read the calendar,
                      creates or refreshes the managed webhook for{" "}
                      <code>event.created</code>, <code>event.updated</code>, and{" "}
                      <code>event.canceled</code>, then refreshes the mirrored
                      events and tickets used by public checkout.
                    </p>
                  </ConsoleInfoTip>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>CipherPay connection</h2>
            <p className="subtle-text">
              Each calendar needs one current CipherPay account for checkout.
              Saving this form for a calendar updates that current connection in
              place instead of creating a second live mapping.
            </p>
          </div>
        </div>

        <ConsoleDisclosure
          defaultOpen={detail.calendars.length > 0 && !detail.cipherpay_connections.length}
          description="Leave the base URLs blank unless this tenant uses custom CipherPay endpoints."
          title="CipherPay setup"
        >
          <form action={createCipherPayConnectionAction} className="console-content">
            <input name="tenant_id" type="hidden" value={detail.tenant.tenant_id} />
            <input name="redirect_to" type="hidden" value={`/ops/tenants/${detail.tenant.tenant_id}`} />
            <div className="public-field-grid">
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Choose which mirrored calendar this payment account should serve."
                  label="Calendar connection"
                />
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
                <ConsoleFieldLabel
                  info="Use testnet for staging and mainnet for real payments."
                  label="Network"
                />
                <select className="console-input" name="network" required>
                  <option value="testnet">testnet</option>
                  <option value="mainnet">mainnet</option>
                </select>
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Override only for a custom CipherPay deployment. Leave blank to use the default for the selected network."
                  label="API base URL"
                  optional
                />
                <input className="console-input" name="api_base_url" type="text" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Override only for a custom CipherPay checkout host. Leave blank to use the default for the selected network."
                  label="Checkout base URL"
                  optional
                />
                <input className="console-input" name="checkout_base_url" type="text" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Organizer-owned CipherPay API key used to create invoices."
                  label="CipherPay API key"
                />
                <input className="console-input" name="cipherpay_api_key" required type="password" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Webhook secret configured in CipherPay for /api/cipherpay/webhook."
                  label="CipherPay webhook secret"
                />
                <input className="console-input" name="cipherpay_webhook_secret" required type="password" />
              </label>
            </div>
            <button className="button" type="submit">
              Save CipherPay connection
            </button>
          </form>
        </ConsoleDisclosure>

        <div className="console-card-grid">
          {currentCipherPayConnections.map(
            ({ calendarName, connection, previews }) => (
              <article
                className="console-detail-card"
                key={connection.cipherpay_connection_id}
              >
                <p className="console-kpi-label">Current checkout connection</p>
                <h3>{connection.network}</h3>
                <p className="subtle-text">
                  {calendarName} · validation {connection.status}
                </p>
                <p className="subtle-text">{connection.api_base_url}</p>
                <p className="subtle-text">
                  API {previews?.api.preview || "missing"} · webhook{" "}
                  {previews?.webhook.preview || "missing"}
                </p>
                <form action={validateCipherPayConnectionAction}>
                  <input
                    name="cipherpay_connection_id"
                    type="hidden"
                    value={connection.cipherpay_connection_id}
                  />
                  <input
                    name="redirect_to"
                    type="hidden"
                    value={`/ops/tenants/${detail.tenant.tenant_id}`}
                  />
                  <button className="button button-secondary button-small" type="submit">
                    Mark validated
                  </button>
                </form>
              </article>
            ),
          )}
        </div>

        {historicalCipherPayConnections.length ? (
          <ConsoleDisclosure
            description="Older saved settings are kept for rollback and support reference, but they are not used for checkout."
            title="Previous saved settings"
          >
            <div className="console-card-grid">
              {historicalCipherPayConnections.map(
                ({ calendarName, connection, previews }) => (
                  <article
                    className="console-detail-card"
                    key={connection.cipherpay_connection_id}
                  >
                    <p className="console-kpi-label">Previous saved settings</p>
                    <h3>{connection.network}</h3>
                    <p className="subtle-text">
                      {calendarName} · last known validation {connection.status}
                    </p>
                    <p className="subtle-text">{connection.api_base_url}</p>
                    <p className="subtle-text">
                      API {previews?.api.preview || "missing"} · webhook{" "}
                      {previews?.webhook.preview || "missing"}
                    </p>
                    <p className="subtle-text">
                      This row is kept for reference only and is not attached to
                      checkout.
                    </p>
                  </article>
                ),
              )}
            </div>
          </ConsoleDisclosure>
        ) : null}
      </section>
    </>
  );
}
