import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  isAdminAuthEnabled,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { adminSessionCookieOptions } from "@/lib/admin-auth-server";
import { jsonError, jsonOk } from "@/lib/http";
import { getRuntimeConfig } from "@/lib/test-harness/state";
import { hasCoreTestSetup } from "@/lib/test-harness/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminAuthEnabled()) {
    return jsonError("Admin auth is not enabled for this environment.", 503);
  }

  const body = await request.json().catch(() => null);
  const password =
    body && typeof body === "object" && typeof body.password === "string"
      ? body.password
      : "";

  if (!verifyAdminPassword(password)) {
    return jsonError("Invalid password.", 401);
  }

  const config = await getRuntimeConfig({ allowMissingTable: true });
  const cookieStore = await cookies();
  cookieStore.set(
    ADMIN_SESSION_COOKIE,
    createAdminSessionToken(),
    adminSessionCookieOptions(),
  );

  return jsonOk({
    ok: true,
    next: hasCoreTestSetup(config) ? "/dashboard" : "/admin",
  });
}
