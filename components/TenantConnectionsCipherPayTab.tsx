import {
  createCipherPayConnectionAction,
  validateCipherPayConnectionAction,
} from "@/app/dashboard/actions";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { ConsoleFieldLabel } from "@/components/ConsoleFieldLabel";
import { ConsoleForm } from "@/components/ConsoleForm";
import { ConsoleFormPendingNote } from "@/components/ConsoleFormPendingNote";
import { ConsoleSection } from "@/components/ConsoleSection";
import { ConsoleSubmitButton } from "@/components/ConsoleSubmitButton";
import type { TenantOpsDetail } from "@/lib/tenancy/service";

function withHash(path: string, hash: string) {
  return `${path}#${hash}`;
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

  return (
    <div className="console-content">
      <ConsoleSection
        className="console-anchor-target"
        id="connect-cipherpay"
        title="CipherPay checkout"
        titleAs="h3"
      >

        <ConsoleDisclosure
          defaultOpen={
            detail.calendars.length > 0 && !detail.cipherpay_connections.length
          }
          description="Leave the base URLs blank unless your organization uses custom CipherPay endpoints."
          title="Add or replace a checkout connection"
        >
          <ConsoleForm action={createCipherPayConnectionAction}>
            <input
              name="tenant_slug"
              type="hidden"
              value={detail.tenant.slug}
            />
            <input
              name="redirect_to"
              type="hidden"
              value={
                onboardingIncomplete
                  ? setupReturnPath
                  : withHash(cipherPayTabPath, "connect-cipherpay")
              }
            />
            <div className="public-field-grid">
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Choose which mirrored calendar this payment account should serve."
                  label="Calendar connection"
                />
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
                <input
                  className="console-input"
                  name="api_base_url"
                  type="text"
                />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Override only for a custom CipherPay checkout host. Leave blank to use the default for the selected network."
                  label="Checkout base URL"
                  optional
                />
                <input
                  className="console-input"
                  name="checkout_base_url"
                  type="text"
                />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Organizer-owned CipherPay API key used to create invoices."
                  label="CipherPay API key"
                />
                <input
                  className="console-input"
                  name="cipherpay_api_key"
                  required
                  type="password"
                />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Webhook secret configured in CipherPay for /api/cipherpay/webhook."
                  label="CipherPay webhook secret"
                />
                <input
                  className="console-input"
                  name="cipherpay_webhook_secret"
                  required
                  type="password"
                />
              </label>
            </div>
            <div className="button-row">
              <ConsoleSubmitButton
                className="button"
                label="Save CipherPay connection"
                pendingLabel="Saving CipherPay connection..."
              />
            </div>
            <ConsoleFormPendingNote pendingLabel="Saving and validating your CipherPay connection..." />
          </ConsoleForm>
        </ConsoleDisclosure>

        {!currentCipherPayConnections.length ? (
          <div
            className="console-preview-empty console-anchor-target"
            id="current-cipherpay-connection"
          >
            <strong>No live checkout connection yet</strong>
            <p className="subtle-text">
              Add a CipherPay connection to make public checkout payable for one
              of your mirrored calendars.
            </p>
          </div>
        ) : (
          <div
            className="console-card-grid console-anchor-target"
            id="current-cipherpay-connection"
          >
            {currentCipherPayConnections.map(
              ({ calendarName, connection, previews }) => (
                <article
                  className="console-detail-card"
                  key={connection.cipherpay_connection_id}
                >
                  <p className="console-kpi-label">
                    Current checkout connection
                  </p>
                  <h4>{connection.network}</h4>
                  <p className="subtle-text">
                    {calendarName} · validation {connection.status}
                  </p>
                  <p className="subtle-text">{connection.api_base_url}</p>
                  <p className="subtle-text">
                    API {previews?.api.preview || "missing"} · webhook{" "}
                    {previews?.webhook.preview || "missing"}
                  </p>
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
                      <ConsoleFormPendingNote pendingLabel="Validating this CipherPay connection..." />
                    </ConsoleForm>
                  ) : null}
                </article>
              ),
            )}
          </div>
        )}

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
                    <h4>{connection.network}</h4>
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
      </ConsoleSection>
    </div>
  );
}
