import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthMode,
  isAdminAuthEnabled,
  isAdminSessionTokenValid,
} from "@/lib/admin-auth";
import { appPath } from "@/lib/app-paths";
import { Button, Input } from "@/components/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OpsLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email_sent?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value || null;
  const authMode = getAdminAuthMode();

  if (!isAdminAuthEnabled()) {
    redirect("/ops");
  }

  if (isAdminSessionTokenValid(session)) {
    redirect("/ops");
  }

  const errorMessage =
    resolvedSearchParams.error === "invalid_password"
      ? "The password was not accepted."
      : resolvedSearchParams.error === "invalid_email"
        ? "Enter a valid email address."
        : resolvedSearchParams.error === "invalid_link"
          ? "That sign-in link is invalid or has already been used."
          : resolvedSearchParams.error === "email_delivery_failed"
            ? "We couldn't send the sign-in email. Confirm SES and APP_PUBLIC_ORIGIN are configured."
            : resolvedSearchParams.error === "rate_limited"
              ? "Too many login attempts. Please wait and try again."
              : resolvedSearchParams.error === "auth_disabled"
                ? "Operator auth is not enabled for this environment."
                : null;

  return (
    <main className="page console-shell">
      <section className="card console-card-shell">
        <div className="console-content">
          <section className="console-section">
            <p className="eyebrow">Protected access</p>
            <h1>Operator sign-in</h1>
            <p className="subtle-text">
              {authMode === "email"
                ? "Enter the operator email address to receive a one-time sign-in link for onboarding, recovery, and reporting tools."
                : "Use the shared operator password to access onboarding, recovery, and reporting tools."}
            </p>
            {resolvedSearchParams.email_sent === "1" ? (
              <p className="console-success-text">
                If that email address is approved for operator access, we sent a one-time sign-in link.
              </p>
            ) : null}
            {errorMessage ? (
              <p className="console-error-text">{errorMessage}</p>
            ) : null}

            <form action={appPath("/api/ops/login")} className="console-content" method="post">
              {authMode === "email" ? (
                <Input
                  autoComplete="email"
                  info="Use the one operator email configured for this environment. The link expires after 15 minutes and can only be used once."
                  label="Email address"
                  name="email"
                  required
                  type="email"
                />
              ) : (
                <Input
                  label="Password"
                  name="password"
                  required
                  type="password"
                />
              )}
              <div className="button-row">
                <Button type="submit">
                  {authMode === "email" ? "Email sign-in link" : "Sign in"}
                </Button>
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
