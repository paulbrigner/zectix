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
          <section className="console-section console-login-card">
            <a href={appPath("/")} className="console-login-wordmark">ZecTix</a>
            <h1>Start your organizer setup</h1>
            <p className="subtle-text">
              Create your organizer account and we&apos;ll send a sign-in link
              to get you started.
            </p>

            {resolvedSearchParams.email_sent === "1" ? (
              <div className="tenant-start-notice tenant-start-notice-success" role="status">
                <strong>Check your inbox for the sign-in link.</strong>
                <p>
                  If an account already exists for this email, we sent the link there.
                </p>
              </div>
            ) : null}
            {errorMessage ? <p className="console-error-text">{errorMessage}</p> : null}

            <form action={appPath("/api/dashboard/start")} method="post" className="console-login-form">
              <Input
                autoComplete="organization"
                info="Shown in your dashboard and checkout pages."
                label="Organization name"
                maxLength={160}
                name="name"
                required
                type="text"
              />
              <Input
                autoComplete="email"
                info="We&apos;ll send the sign-in link here."
                label="Work email"
                maxLength={320}
                name="email"
                required
                type="email"
              />
              <Button type="submit">Create account</Button>
            </form>

            <p className="console-login-footer">
              {"Already have an account? "}
              <a href={appPath("/dashboard/login")}>Sign in</a>
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
