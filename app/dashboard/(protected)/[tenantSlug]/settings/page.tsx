import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default async function TenantSettingsRedirectPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/dashboard/${encodeURIComponent(tenantSlug)}/connections`);
}
