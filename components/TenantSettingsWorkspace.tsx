import {
  deleteTenantAccountAction,
  redirectToTenantBillingAction,
  updateTenantContactEmailAction,
} from "@/app/dashboard/actions";
import { ConsoleConfirmDialog } from "@/components/ConsoleConfirmDialog";
import { ConsoleFieldLabel } from "@/components/ConsoleFieldLabel";
import { ConsoleForm } from "@/components/ConsoleForm";
import { ConsoleFormPendingNote } from "@/components/ConsoleFormPendingNote";
import { ConsoleSection } from "@/components/ConsoleSection";
import { ConsoleSubmitButton } from "@/components/ConsoleSubmitButton";
import { formatZecAmount } from "@/lib/app-state/utils";
import type { TenantOpsDetail } from "@/lib/tenancy/service";

type SearchParamValue = string | string[] | undefined;

function readSearchValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function totalOutstandingZatoshis(detail: TenantOpsDetail) {
  return (detail.billing?.cycles || []).reduce(
    (total, cycle) => total + cycle.outstanding_zatoshis,
    0,
  );
}

export function TenantSettingsWorkspace({
  detail,
  searchParams,
  tenantBasePath,
}: {
  detail: TenantOpsDetail;
  searchParams: Record<string, SearchParamValue>;
  tenantBasePath: string;
}) {
  const settingsBasePath = `${tenantBasePath}/settings`;
  const outstandingZatoshis = totalOutstandingZatoshis(detail);
  const settlementThresholdZatoshis = detail.tenant.settlement_threshold_zatoshis;
  const deletionBlockedByBalance = outstandingZatoshis > settlementThresholdZatoshis;
  const emailPending = readSearchValue(searchParams.email_pending) === "1";
  const emailUpdated = readSearchValue(searchParams.email_updated) === "1";
  const emailError = readSearchValue(searchParams.email_error);
  const deleteError = readSearchValue(searchParams.delete_error);

  return (
    <div className="console-page-body">
      {emailPending ? (
        <ConsoleSection
          className="tenant-onboarding-complete-banner"
          eyebrow={<p className="console-kpi-label">Check your inbox</p>}
          role="status"
          title="Confirm the new account email before it takes effect."
          titleAs="h3"
        >
          <p className="subtle-text">
            We sent a confirmation link to the new address. Your current sign-in email
            stays active until that link is used.
          </p>
        </ConsoleSection>
      ) : null}

      {emailUpdated ? (
        <ConsoleSection
          className="tenant-onboarding-complete-banner"
          eyebrow={<p className="console-kpi-label">Account updated</p>}
          role="status"
          title="Your new sign-in email is now active."
          titleAs="h3"
        >
          <p className="subtle-text">
            New dashboard magic links will now be sent to {detail.tenant.contact_email}.
          </p>
        </ConsoleSection>
      ) : null}

      {emailError ? (
        <ConsoleSection
          eyebrow={<p className="console-kpi-label">Email update issue</p>}
          role="alert"
          title={emailError}
          titleAs="h3"
        >
          <p className="subtle-text">
            Double-check the address and try again.
          </p>
        </ConsoleSection>
      ) : null}

      {deleteError ? (
        <ConsoleSection
          eyebrow={<p className="console-kpi-label">Delete account blocked</p>}
          role="alert"
          title={
            deleteError === "balance_due"
              ? "Settle any outstanding balance before deleting this account."
              : deleteError
          }
          titleAs="h3"
        >
          <p className="subtle-text">
            {deleteError === "balance_due"
              ? "Use the Billing workspace to clear the balance, then return here."
              : "Try again in a moment. If the problem continues, contact support."}
          </p>
        </ConsoleSection>
      ) : null}

      <ConsoleSection
        description="This email receives organizer sign-in links for this account."
        title="Settings"
      >
        <div className="console-card-grid">
          <article className="console-detail-card">
            <p className="console-kpi-label">Current account email</p>
            <h3>{detail.tenant.contact_email}</h3>
            <p className="subtle-text">
              This is the address currently allowed to sign in to this organizer dashboard.
            </p>
          </article>

          <article className="console-detail-card">
            <p className="console-kpi-label">Change account email</p>
            <ConsoleForm action={updateTenantContactEmailAction}>
              <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
              <input name="redirect_to" type="hidden" value={settingsBasePath} />
              <label className="console-field">
                <ConsoleFieldLabel
                  info="We will send a confirmation link to the new address. The current sign-in email stays active until you confirm the change."
                  label="New account email"
                />
                <input
                  className="console-input"
                  defaultValue={detail.tenant.contact_email}
                  name="contact_email"
                  required
                  type="email"
                />
              </label>
              <div className="button-row">
                <ConsoleSubmitButton
                  className="button"
                  label="Send confirmation email"
                  pendingLabel="Sending confirmation email..."
                />
              </div>
              <ConsoleFormPendingNote pendingLabel="Sending an email confirmation link..." />
            </ConsoleForm>
          </article>
        </div>
      </ConsoleSection>

      <ConsoleSection
        description="Permanently delete your account and all data. This cannot be undone. You must settle any outstanding billing balance above the settlement threshold before deleting."
        title="DANGER ZONE"
      >
        <article className="console-detail-card">
          {deletionBlockedByBalance ? (
            <p className="subtle-text">
              Current outstanding balance: {formatZecAmount(outstandingZatoshis)}
            </p>
          ) : null}
          <div className="button-row">
            {deletionBlockedByBalance ? (
              <ConsoleConfirmDialog
                action={redirectToTenantBillingAction}
                body={
                  <p className="subtle-text">
                    This account still has an outstanding balance of{" "}
                    {formatZecAmount(outstandingZatoshis)}, which is above the deletion
                    threshold of {formatZecAmount(settlementThresholdZatoshis)}. Settle it
                    in Billing first, then return here to delete the account.
                  </p>
                }
                confirmClassName="button button-small"
                confirmLabel="Open billing"
                description="You must settle balances above the settlement threshold before deleting."
                title="Settle outstanding balance first"
                triggerClassName="button button-danger button-small"
                triggerLabel="Delete account"
              >
                <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
              </ConsoleConfirmDialog>
            ) : (
              <ConsoleConfirmDialog
                action={deleteTenantAccountAction}
                body={
                  <p className="subtle-text">
                    This permanently deletes the organizer account, mirrored events,
                    checkout sessions, billing history, and active webhook access for{" "}
                    {detail.tenant.name}.
                  </p>
                }
                confirmLabel="Delete account"
                description="This permanently deletes the account and all associated organizer data."
                title={`Delete ${detail.tenant.name}?`}
                triggerClassName="button button-danger button-small"
                triggerLabel="Delete account"
              >
                <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
                <input name="redirect_to" type="hidden" value={settingsBasePath} />
              </ConsoleConfirmDialog>
            )}
          </div>
        </article>
      </ConsoleSection>
    </div>
  );
}
