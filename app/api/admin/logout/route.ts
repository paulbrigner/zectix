import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { putAdminAuditEvent } from "@/lib/app-state/state";
import { jsonOk } from "@/lib/http";
import { ensureSameOriginMutation, getTrustedIpAddress } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const originError = ensureSameOriginMutation(request);
  if (originError) {
    return originError;
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  await putAdminAuditEvent({
    event_type: "admin.logout",
    actor_ip: getTrustedIpAddress(request),
    actor_origin: request.headers.get("origin"),
    request_headers_json: {
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      "user-agent": request.headers.get("user-agent"),
    },
    metadata_json: null,
  });

  return jsonOk({ ok: true });
}
