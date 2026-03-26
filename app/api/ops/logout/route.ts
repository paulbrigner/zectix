import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { adminSessionCookieOptions } from "@/lib/admin-auth-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    ...adminSessionCookieOptions(),
    maxAge: 0,
  });

  return Response.redirect(new URL("/ops/login", request.url), 303);
}
