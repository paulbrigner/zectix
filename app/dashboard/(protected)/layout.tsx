import type { ReactNode } from "react";
import { DashboardProtectedHeader } from "@/components/DashboardProtectedHeader";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";

export const runtime = "nodejs";

export default async function TenantLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireTenantPageAccess();

  return (
    <main className="page console-shell">
      <section className="card console-card-shell">
        <DashboardProtectedHeader />

        <div className="console-content">{children}</div>
      </section>
    </main>
  );
}
