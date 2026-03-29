import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Button, Input } from "@/components/ui";
import { appPath } from "@/lib/app-paths";
import {
  isTenantEmailAuthEnabled,
  readTenantSessionEmail,
  TENANT_SESSION_COOKIE,
} from "@/lib/tenant-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantStartPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email_sent?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const session = cookieStore.get(TENANT_SESSION_COOKIE)?.value || null;

  if (!isTenantEmailAuthEnabled()) {
    redirect("/");
  }

  if (readTenantSessionEmail(session)) {
    redirect("/dashboard");
  }

  const errorMessage =
    resolvedSearchParams.error === "invalid_name"
      ? "Enter an organization name to start onboarding."
      : resolvedSearchParams.error === "invalid_email"
        ? "Enter a valid email address."
        : resolvedSearchParams.error === "email_delivery_failed"
          ? "We created or reused your draft organizer account, but we couldn't send the sign-in email."
          : resolvedSearchParams.error === "rate_limited"
            ? "Too many onboarding attempts. Please wait and try again."
            : resolvedSearchParams.error === "auth_disabled"
              ? "Organizer sign-in is not enabled for this environment."
              : null;

  return (
    <main className="page console-shell">
      <section className="card console-card-shell">
        <div className="console-content">
          <section className="console-section">
            <p className="eyebrow">Self-serve onboarding</p>
            <h1>Start your organizer setup</h1>
            <p className="subtle-text">
              We&apos;ll create a draft organizer account, then email a one-time
              sign-in link so you can connect Luma, validate your calendar, and
              configure CipherPay from the tenant dashboard.
            </p>
            <p className="subtle-text">
              Public checkout stays dark until the tenant is activated.
            </p>

            {resolvedSearchParams.email_sent === "1" ? (
              <p className="console-success-text">
                Check your inbox for the one-time sign-in link. If this looked
                like an existing draft organizer, we reused it.
              </p>
            ) : null}
            {errorMessage ? <p className="console-error-text">{errorMessage}</p> : null}

            <form action={appPath("/api/dashboard/start")} className="console-content" method="post">
              <div className="public-field-grid">
                <Input
                  autoComplete="organization"
                  info="This becomes the organizer name shown in your dashboard and future public checkout surfaces."
                  label="Organization name"
                  maxLength={160}
                  name="name"
                  required
                  type="text"
                />
                <Input
                  autoComplete="email"
                  info="We use this as the first owner email and send the sign-in link here."
                  label="Work email"
                  maxLength={320}
                  name="email"
                  required
                  type="email"
                />
                <Input
                  info="Optional public-friendly slug. Leave blank to generate it from the organization name."
                  label="Preferred slug"
                  maxLength={80}
                  name="slug"
                  optional
                  type="text"
                />
              </div>
              <div className="button-row">
                <Button type="submit">Create draft and email sign-in link</Button>
                <Button variant="secondary" href="/dashboard/login">
                  Existing organizer sign-in
                </Button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
