import { submitSupportRequestAction } from "@/app/dashboard/actions";
import { ConsoleFieldLabel, ConsoleFieldHint } from "@/components/ConsoleFieldLabel";
import { ConsoleFormPendingNote } from "@/components/ConsoleFormPendingNote";
import { ConsoleSection } from "@/components/ConsoleSection";
import { ConsoleSubmitButton } from "@/components/ConsoleSubmitButton";
import { TenantDashboardShellHeader } from "@/components/TenantDashboardShellHeader";
import { hasCompletedTenantOnboarding } from "@/lib/tenant-self-serve";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import {
  getTenantSelfServeDetailBySlug,
  listSelfServeTenantsForEmail,
} from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readTenantSlugFromPath(value: string | undefined) {
  if (!value) {
    return "";
  }

  const segments = value.split("/").filter(Boolean);
  if (segments[0] !== "dashboard" || !segments[1] || segments[1] === "help") {
    return "";
  }

  return segments[1];
}

export default async function TenantHelpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; tenant?: string; from?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const email = await requireTenantPageAccess();
  const tenants = await listSelfServeTenantsForEmail(email);
  const tenantSlugFromPath = readTenantSlugFromPath(resolvedSearchParams.from);
  const preferredTenantSlug = resolvedSearchParams.tenant || tenantSlugFromPath;
  const selectedTenantSlug =
    preferredTenantSlug &&
    tenants.some((tenant) => tenant.slug === preferredTenantSlug)
      ? preferredTenantSlug
      : tenants.length === 1
        ? tenants[0].slug
        : "";
  const selectedTenant =
    tenants.find((tenant) => tenant.slug === selectedTenantSlug) || null;
  const headerTenant = selectedTenant || tenants[0] || null;
  const headerBasePath = headerTenant
    ? `/dashboard/${encodeURIComponent(headerTenant.slug)}`
    : "/dashboard";
  const headerDetail = headerTenant
    ? await getTenantSelfServeDetailBySlug(headerTenant.slug, email)
    : null;
  const helpRedirectTo = headerTenant
    ? `/dashboard/help?tenant=${encodeURIComponent(headerTenant.slug)}`
    : "/dashboard/help";

  return (
    <>
      {headerTenant ? (
        <TenantDashboardShellHeader
          basePath={headerBasePath}
          onboardingIncomplete={
            headerDetail
              ? !hasCompletedTenantOnboarding(headerDetail.tenant)
              : false
          }
          organizationName={headerTenant.name}
        />
      ) : null}

      <div className="console-page-body settings-page-body">
        {resolvedSearchParams.sent === "1" ? (
          <ConsoleSection
            className="tenant-onboarding-complete-banner"
            eyebrow={<p className="console-kpi-label">Request sent</p>}
            role="status"
            title="Your support request was sent."
            titleAs="h3"
          >
            <p className="subtle-text">
              We&apos;ll follow up at <strong>{email}</strong> as soon as possible.
            </p>
          </ConsoleSection>
        ) : null}

        {resolvedSearchParams.error ? (
          <ConsoleSection
            eyebrow={<p className="console-kpi-label">Something went wrong</p>}
            role="alert"
            title={resolvedSearchParams.error}
            titleAs="h3"
          >
            <p className="subtle-text">
              Please try again, or use the support form below if the problem
              continues.
            </p>
          </ConsoleSection>
        ) : null}

        <ConsoleSection
          description={`Describe the issue and we'll follow up at ${email}.`}
          title="Help"
        >
          <form action={submitSupportRequestAction} className="console-content">
            <input name="redirect_to" type="hidden" value={helpRedirectTo} />
            <input
              name="context_path"
              type="hidden"
              value={resolvedSearchParams.from || ""}
            />

            {tenants.length > 1 ? (
              <label className="console-field">
                <ConsoleFieldLabel label="Organization" optional />
                <ConsoleFieldHint>
                  Choose the organization this request is about.
                </ConsoleFieldHint>
                <select
                  className="console-input"
                  defaultValue={selectedTenantSlug}
                  name="tenant_slug"
                >
                  <option value="">General question</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.tenant_id} value={tenant.slug}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : selectedTenant ? (
              <input name="tenant_slug" type="hidden" value={selectedTenant.slug} />
            ) : null}

            <label className="console-field">
              <ConsoleFieldLabel label="Topic" />
              <select className="console-input" defaultValue="" name="category">
                <option disabled value="">Select a topic...</option>
                <option value="billing">Billing &amp; payments</option>
                <option value="luma_sync">Luma sync issues</option>
                <option value="embed">Embed configuration</option>
                <option value="account">Account settings</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="console-field">
              <ConsoleFieldLabel label="Subject" />
              <ConsoleFieldHint>
                Keep it short — e.g. &quot;Luma sync failed&quot; or &quot;Embed
                origin question&quot;.
              </ConsoleFieldHint>
              <input className="console-input" name="subject" required type="text" />
            </label>

            <label className="console-field">
              <ConsoleFieldLabel label="Message" />
              <ConsoleFieldHint>
                Include what you expected, what happened instead, and any event or
                checkout details that help us trace it.
              </ConsoleFieldHint>
              <textarea
                className="console-input console-textarea"
                name="message"
                required
              />
            </label>

            <div className="button-row">
              <ConsoleSubmitButton
                className="button button-small"
                label="Send support request"
                pendingLabel="Sending support request..."
              />
            </div>
            <ConsoleFormPendingNote pendingLabel="Sending your message..." />
          </form>
        </ConsoleSection>
      </div>
    </>
  );
}
