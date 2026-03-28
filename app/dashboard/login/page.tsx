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

export default async function TenantLoginPage({
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
    resolvedSearchParams.error === "invalid_email"
      ? "Enter a valid email address."
      : resolvedSearchParams.error === "invalid_link"
        ? "That sign-in link is invalid or has already been used."
        : resolvedSearchParams.error === "email_delivery_failed"
          ? "We couldn't send the sign-in email. Confirm SES and APP_PUBLIC_ORIGIN are configured."
        : resolvedSearchParams.error === "rate_limited"
            ? "Too many sign-in attempts. Please wait and try again."
            : resolvedSearchParams.error === "auth_disabled"
              ? "Organizer sign-in is not enabled for this environment."
              : null;

  return (
    <main className="page console-shell">
      <section className="card console-card-shell">
        <div className="console-content">
          <section className="console-section">
            <p className="eyebrow">Organizer access</p>
            <h1>Sign in to your dashboard</h1>
            <p className="subtle-text">
              Enter the email address configured as your account contact to receive a one-time
              sign-in link for calendar setup, event review, and checkout monitoring.
            </p>
            {resolvedSearchParams.email_sent === "1" ? (
              <p className="console-success-text">
                If that email address is configured for an account, we sent a one-time sign-in link.
              </p>
            ) : null}
            {errorMessage ? <p className="console-error-text">{errorMessage}</p> : null}

            <form action={appPath("/api/dashboard/login")} className="console-content" method="post">
              <Input
                autoComplete="email"
                info="Use the account contact email. The link expires after 15 minutes and can only be used once."
                label="Email address"
                name="email"
                required
                type="email"
              />
              <div className="button-row">
                <Button type="submit">Email sign-in link</Button>
                <Button variant="secondary" href="/">
                  Back home
                </Button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
