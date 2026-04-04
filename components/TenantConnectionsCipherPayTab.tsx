import {
  createCipherPayConnectionAction,
  validateCipherPayConnectionAction,
} from "@/app/dashboard/actions";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { ConsoleFieldLabel, ConsoleFieldHint } from "@/components/ConsoleFieldLabel";
import { ConsoleForm } from "@/components/ConsoleForm";
import { ConsoleFormPendingNote } from "@/components/ConsoleFormPendingNote";
import { ConsoleSubmitButton } from "@/components/ConsoleSubmitButton";
import type { TenantOpsDetail } from "@/lib/tenancy/service";

function withHash(path: string, hash: string) {
  return `${path}#${hash}`;
}

function CipherPayConnectionForm({
  detail,
  primaryCalendar,
  redirectTo,
}: {
  detail: TenantOpsDetail;
  primaryCalendar: TenantOpsDetail["calendars"][number] | null;
  redirectTo: string;
}) {
  return (
    <ConsoleForm action={createCipherPayConnectionAction}>
      <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
      <input name="redirect_to" type="hidden" value={redirectTo} />
      <div className="public-field-grid">
        {primaryCalendar ? (
          <>
            <input
              name="calendar_connection_id"
              type="hidden"
              value={primaryCalendar.calendar_connection_id}
            />
            <div className="console-field">
              <ConsoleFieldLabel label="Calendar" />
              <div className="console-input">
                {primaryCalendar.display_name}
              </div>
            </div>
          </>
        ) : (
          <label className="console-field">
            <ConsoleFieldLabel label="Calendar" />
            <select
              className="console-input"
              name="calendar_connection_id"
              required
            >
              <option value="">Select calendar</option>
              {detail.calendars.map((calendar) => (
                <option
                  key={calendar.calendar_connection_id}
                  value={calendar.calendar_connection_id}
                >
                  {calendar.display_name}
                </option>
              ))}
            </select>
            <ConsoleFieldHint>
              Choose which calendar this checkout connection should serve.
            </ConsoleFieldHint>
          </label>
        )}
        <label className="console-field">
          <ConsoleFieldLabel label="Network" />
          <select className="console-input" name="network" required>
            <option value="testnet">testnet</option>
            <option value="mainnet">mainnet</option>
          </select>
          <ConsoleFieldHint>
            Use testnet for staging and mainnet for real payments.
          </ConsoleFieldHint>
        </label>
        <label className="console-field">
          <ConsoleFieldLabel label="CipherPay API key" />
          <input
            className="console-input"
            name="cipherpay_api_key"
            required
            type="password"
          />
          <ConsoleFieldHint>
            Organizer-owned API key used to create invoices.
          </ConsoleFieldHint>
        </label>
        <label className="console-field">
          <ConsoleFieldLabel label="Webhook secret" />
          <input
            className="console-input"
            name="cipherpay_webhook_secret"
            required
            type="password"
          />
          <ConsoleFieldHint>
            Webhook secret configured in CipherPay for /api/cipherpay/webhook.
          </ConsoleFieldHint>
        </label>
        <label className="console-field">
          <ConsoleFieldLabel label="API base URL" optional />
          <input className="console-input" name="api_base_url" type="text" />
          <ConsoleFieldHint>
            Override for a custom deployment. Leave blank for the default.
          </ConsoleFieldHint>
        </label>
        <label className="console-field">
          <ConsoleFieldLabel label="Checkout base URL" optional />
          <input
            className="console-input"
            name="checkout_base_url"
            type="text"
          />
          <ConsoleFieldHint>
            Override for a custom checkout host. Leave blank for the default.
          </ConsoleFieldHint>
        </label>
      </div>
      <div className="button-row">
        <ConsoleSubmitButton
          className="button"
          label="Save checkout connection"
          pendingLabel="Saving..."
        />
      </div>
      <ConsoleFormPendingNote pendingLabel="Saving and validating your CipherPay connection..." />
    </ConsoleForm>
  );
}

export function TenantConnectionsCipherPayTab({
  cipherPayTabPath,
  detail,
  onboardingIncomplete,
  setupTabPath,
}: {
  cipherPayTabPath: string;
  detail: TenantOpsDetail;
  onboardingIncomplete: boolean;
  setupTabPath: string;
}) {
  const setupReturnPath = withHash(setupTabPath, "setup-checklist");
  const cipherPayReturnPath = onboardingIncomplete
    ? setupReturnPath
    : withHash(cipherPayTabPath, "current-cipherpay-connection");
  const singleCalendar = detail.calendars.length === 1;
  const primaryCalendar = singleCalendar ? detail.calendars[0] : null;
  const formRedirectTo = onboardingIncomplete
    ? setupReturnPath
    : withHash(cipherPayTabPath, "connect-cipherpay");

  const calendarNamesById = new Map(
    detail.calendars.map((calendar) => [
      calendar.calendar_connection_id,
      calendar.display_name,
    ]),
  );
  const cipherPayConnectionRows = detail.cipherpay_connections.map(
    (connection) => {
      const previews = detail.cipherpay_secret_previews.get(
        connection.cipherpay_connection_id,
      );
      const activeConnection =
        detail.active_cipherpay_connections_by_calendar.get(
          connection.calendar_connection_id,
        );
      return {
        calendarName:
          calendarNamesById.get(connection.calendar_connection_id) ||
          "Unknown calendar",
        connection,
        isCurrentConnection:
          activeConnection?.cipherpay_connection_id ===
          connection.cipherpay_connection_id,
        previews,
      };
    },
  );
  const currentCipherPayConnections = cipherPayConnectionRows.filter(
    (entry) => entry.isCurrentConnection,
  );
  const historicalCipherPayConnections = cipherPayConnectionRows.filter(
    (entry) => !entry.isCurrentConnection,
  );
  const hasActiveConnection = currentCipherPayConnections.length > 0;

  return (
    <div className="console-content">
      {!hasActiveConnection ? (
        <article
          className="console-detail-card console-luma-card console-anchor-target"
          id="connect-cipherpay"
        >
          <div className="console-luma-card-head">
            <div>
              <h3>Connect CipherPay checkout</h3>
              <p className="subtle-text">
                Save a CipherPay API key and webhook secret to enable paid
                checkout for your calendar events.
              </p>
            </div>
          </div>
          <CipherPayConnectionForm
            detail={detail}
            primaryCalendar={primaryCalendar}
            redirectTo={formRedirectTo}
          />
        </article>
      ) : (
        <div className="console-luma-card-stack console-anchor-target" id="current-cipherpay-connection">
          {currentCipherPayConnections.map(
            ({ calendarName, connection, previews }) => (
              <article
                className="console-detail-card console-luma-card"
                key={connection.cipherpay_connection_id}
              >
                <div className="console-luma-card-head">
                  <div>
                    <p className="console-kpi-label">{connection.status}</p>
                    <h4>{connection.network}</h4>
                  </div>
                  <div className="console-luma-card-actions">
                    {connection.status !== "active" ? (
                      <ConsoleForm action={validateCipherPayConnectionAction}>
                        <input
                          name="cipherpay_connection_id"
                          type="hidden"
                          value={connection.cipherpay_connection_id}
                        />
                        <input
                          name="tenant_slug"
                          type="hidden"
                          value={detail.tenant.slug}
                        />
                        <input
                          name="redirect_to"
                          type="hidden"
                          value={cipherPayReturnPath}
                        />
                        <div className="button-row">
                          <ConsoleSubmitButton
                            className="button button-secondary button-small"
                            label="Validate connection"
                            pendingLabel="Validating..."
                          />
                        </div>
                        <ConsoleFormPendingNote pendingLabel="Validating..." />
                      </ConsoleForm>
                    ) : null}
                  </div>
                </div>

                <div className="console-signal-grid">
                  <div className="console-signal-card">
                    <span className="console-kpi-label">Calendar</span>
                    <strong>{calendarName}</strong>
                  </div>
                  <div className="console-signal-card">
                    <span className="console-kpi-label">API key</span>
                    <strong>{previews?.api.preview || "Not saved"}</strong>
                  </div>
                  <div className="console-signal-card">
                    <span className="console-kpi-label">Webhook</span>
                    <strong>{previews?.webhook.preview || "Not saved"}</strong>
                  </div>
                  <div className="console-signal-card">
                    <span className="console-kpi-label">Endpoint</span>
                    <strong className="subtle-text">{connection.api_base_url}</strong>
                  </div>
                </div>

                <ConsoleDisclosure
                  defaultOpen={false}
                  title="Replace checkout settings"
                >
                  <CipherPayConnectionForm
                    detail={detail}
                    primaryCalendar={primaryCalendar}
                    redirectTo={formRedirectTo}
                  />
                </ConsoleDisclosure>
              </article>
            ),
          )}
        </div>
      )}

      {historicalCipherPayConnections.length ? (
        <ConsoleDisclosure
          description="Older saved settings are kept for rollback and support reference."
          title="Previous saved settings"
        >
          <div className="console-card-grid">
            {historicalCipherPayConnections.map(
              ({ calendarName, connection, previews }) => (
                <article
                  className="console-detail-card"
                  key={connection.cipherpay_connection_id}
                >
                  <p className="console-kpi-label">Previous settings</p>
                  <h4>{connection.network}</h4>
                  <p className="subtle-text">
                    {calendarName} · {connection.status}
                  </p>
                  <p className="subtle-text">
                    API {previews?.api.preview || "missing"} · webhook{" "}
                    {previews?.webhook.preview || "missing"}
                  </p>
                </article>
              ),
            )}
          </div>
        </ConsoleDisclosure>
      ) : null}
    </div>
  );
}
