import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  isAdminAuthEnabled,
  isAdminSessionTokenValid,
} from "@/lib/admin-auth";
import { appPath } from "@/lib/app-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OpsLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value || null;

  if (!isAdminAuthEnabled()) {
    redirect("/ops");
  }

  if (isAdminSessionTokenValid(session)) {
    redirect("/ops");
  }

  return (
    <main className="page console-shell">
      <section className="card console-card-shell">
        <div className="console-content">
          <section className="console-section">
            <p className="eyebrow">Protected access</p>
            <h1>Operator sign-in</h1>
            <p className="subtle-text">
              Use the shared operator password to access onboarding, recovery, and reporting tools.
            </p>
            {resolvedSearchParams.error ? (
              <p className="console-error-text">
                {resolvedSearchParams.error === "invalid_password"
                  ? "The password was not accepted."
                  : resolvedSearchParams.error === "rate_limited"
                    ? "Too many login attempts. Please wait and try again."
                    : "Operator auth is not enabled for this environment."}
              </p>
            ) : null}

            <form action={appPath("/api/ops/login")} className="console-content" method="post">
              <label className="console-field">
                <span>Password</span>
                <input className="console-input" name="password" required type="password" />
              </label>
              <div className="button-row">
                <button className="button" type="submit">
                  Sign in
                </button>
                <Link className="button button-secondary" href="/">
                  Back home
                </Link>
              </div>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
