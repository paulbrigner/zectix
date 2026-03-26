import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jsonError } from "@/lib/http";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  isAdminAuthEnabled,
  isAdminSessionTokenValid,
} from "@/lib/admin-auth";

export async function requireAdminPageAccess() {
  if (!isAdminAuthEnabled()) {
    return;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value || null;
  if (!isAdminSessionTokenValid(token)) {
    redirect("/ops/login");
  }
}

export async function ensureAdminApiAccess() {
  if (!isAdminAuthEnabled()) {
    return null;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value || null;
  if (isAdminSessionTokenValid(token)) {
    return null;
  }

  return jsonError("Unauthorized", 401);
}

export const requireOpsPageAccess = requireAdminPageAccess;
export const ensureOpsApiAccess = ensureAdminApiAccess;

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
