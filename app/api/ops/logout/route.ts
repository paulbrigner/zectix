import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { adminSessionCookieOptions } from "@/lib/admin-auth-server";
import { appPath } from "@/lib/app-paths";
import { redirectToPath } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    ...adminSessionCookieOptions(),
    maxAge: 0,
  });

  return redirectToPath(appPath("/ops/login"));
}
