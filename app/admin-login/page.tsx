import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "./login-form";
import {
  ADMIN_SESSION_COOKIE,
  isAdminAuthEnabled,
  isAdminSessionTokenValid,
} from "@/lib/admin-auth";
import { getRuntimeConfig } from "@/lib/test-harness/state";
import { hasCoreTestSetup } from "@/lib/test-harness/utils";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const config = await getRuntimeConfig({ allowMissingTable: true });
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value || null;

  if (!isAdminAuthEnabled()) {
    redirect("/admin");
  }

  if (isAdminSessionTokenValid(session)) {
    redirect(hasCoreTestSetup(config) ? "/dashboard" : "/admin");
  }

  return (
    <main className="page test-shell">
      <section className="card test-card-shell">
        <header className="feed-header">
          <div>
            <p className="eyebrow">Admin sign-in</p>
            <h1>LumaZcash operations access</h1>
            <p className="subtle-text">
              Enter the shared demo password to unlock the admin and dashboard
              routes for this deployment.
            </p>
          </div>
          <div className="button-row">
            <Link className="button button-secondary" href="/">
              Home
            </Link>
          </div>
        </header>

        <div className="test-content">
          <section className="test-section">
            <AdminLoginForm />
          </section>
        </div>
      </section>
    </main>
  );
}

