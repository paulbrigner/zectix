import { jsonError } from "@/lib/http";

function normalizedHost(value: string | null) {
  return value?.trim().toLowerCase() || null;
}

function normalizedOrigin(value: string | null) {
  try {
    return value ? new URL(value).origin.toLowerCase() : null;
  } catch {
    return null;
  }
}

function expectedOrigin(request: Request) {
  const host =
    normalizedHost(request.headers.get("x-forwarded-host")) ||
    normalizedHost(request.headers.get("host"));
  const proto = request.headers.get("x-forwarded-proto")?.trim() || "https";

  if (!host) {
    return null;
  }

  return `${proto}://${host}`.toLowerCase();
}

export function getTrustedIpAddress(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) {
    return null;
  }

  const parts = forwardedFor
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts[0] || null;
}

export function ensureSameOriginMutation(request: Request) {
  const expected = expectedOrigin(request);
  const origin = normalizedOrigin(request.headers.get("origin"));
  const referer = normalizedOrigin(request.headers.get("referer"));

  if (expected && (origin === expected || referer === expected)) {
    return null;
  }

  return jsonError("Forbidden", 403);
}
