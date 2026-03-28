import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jsonError } from "@/lib/http";
import {
  isTenantEmailAuthEnabled,
  readTenantSessionEmail,
  TENANT_SESSION_COOKIE,
  TENANT_SESSION_TTL_SECONDS,
} from "@/lib/tenant-auth";

export async function getTenantSessionEmail() {
  if (!isTenantEmailAuthEnabled()) {
    return null;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(TENANT_SESSION_COOKIE)?.value || null;
  return readTenantSessionEmail(token);
}

export async function requireTenantPageAccess() {
  const email = await getTenantSessionEmail();
  if (!email) {
    redirect("/dashboard/login");
  }

  return email;
}

export async function ensureTenantApiAccess() {
  const email = await getTenantSessionEmail();
  if (email) {
    return email;
  }

  return jsonError("Unauthorized", 401);
}

export function tenantSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: TENANT_SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
