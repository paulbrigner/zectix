import { cookies } from "next/headers";
import { appPath } from "@/lib/app-paths";
import { redirectToPath } from "@/lib/http";
import { TENANT_SESSION_COOKIE } from "@/lib/tenant-auth";
import { tenantSessionCookieOptions } from "@/lib/tenant-auth-server";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(TENANT_SESSION_COOKIE, "", {
    ...tenantSessionCookieOptions(),
    maxAge: 0,
  });

  return redirectToPath(appPath("/dashboard/login"));
}
