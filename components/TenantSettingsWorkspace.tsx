import Link from "next/link";
import {
  deleteTenantAccountAction,
  updateTenantContactEmailAction,
} from "@/app/dashboard/actions";
import { ConsoleConfirmDialog } from "@/components/ConsoleConfirmDialog";
import { ConsoleSection } from "@/components/ConsoleSection";
import { SettingsEmailForm } from "@/components/SettingsEmailForm";
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
    <div className="console-page-body settings-page-body">
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
        title="Account email"
      >
        <dl className="tenant-summary-list">
          <div>
            <dt>Current sign-in email</dt>
            <dd>{detail.tenant.contact_email}</dd>
          </div>
        </dl>

        <SettingsEmailForm
          action={updateTenantContactEmailAction}
          currentEmail={detail.tenant.contact_email}
          redirectTo={settingsBasePath}
          tenantSlug={detail.tenant.slug}
        />
      </ConsoleSection>

      <ConsoleSection
        description="Permanently delete your account and all data. This cannot be undone."
        title="Danger zone"
      >
        {deletionBlockedByBalance ? (
          <div className="settings-balance-warning">
            <p>
              You must settle your outstanding balance of{" "}
              <strong>{formatZecAmount(outstandingZatoshis)}</strong> before deleting
              this account.
            </p>
            <Link className="button button-small" href={`${tenantBasePath}/billing`}>
              Go to billing
            </Link>
          </div>
        ) : (
          <div className="button-row">
            <ConsoleConfirmDialog
              action={deleteTenantAccountAction}
              confirmLabel="Delete account"
              description="This permanently deletes the account and all associated organizer data."
              title={`Delete ${detail.tenant.name}?`}
              triggerClassName="button button-danger button-small"
              triggerLabel="Delete account"
            >
              <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
              <input name="redirect_to" type="hidden" value={settingsBasePath} />
            </ConsoleConfirmDialog>
          </div>
        )}
      </ConsoleSection>
    </div>
  );
}
