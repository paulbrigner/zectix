import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "./login-form";
import {
  ADMIN_SESSION_COOKIE,
  isAdminAuthEnabled,
  isAdminSessionTokenValid,
} from "@/lib/admin-auth";
import { getRuntimeConfig } from "@/lib/app-state/state";
import { hasCoreSetup } from "@/lib/app-state/utils";
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
    redirect(hasCoreSetup(config) ? "/dashboard" : "/admin");
  }

  return (
    <main className="page console-shell">
      <section className="card console-card-shell">
        <header className="feed-header">
          <div>
            <p className="eyebrow">Admin sign-in</p>
            <h1>ZecTix operations access</h1>
            <p className="subtle-text">
              Enter the shared password to unlock the admin and dashboard
              routes for this deployment.
            </p>
          </div>
          <div className="button-row">
            <Link className="button button-secondary" href="/">
              Home
            </Link>
          </div>
        </header>

        <div className="console-content">
          <section className="console-section">
            <AdminLoginForm />
          </section>
        </div>
      </section>
    </main>
  );
}
