import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildSecurityHeaders } from "@/lib/security-headers";

function shouldDisableCaching(pathname: string) {
  return (
    pathname.startsWith("/api/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/ops" ||
    pathname.startsWith("/ops/") ||
    pathname.startsWith("/checkout/")
  );
}

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  const headers = buildSecurityHeaders({
    pathname: request.nextUrl.pathname,
    searchParams: request.nextUrl.searchParams,
    nonce,
  });

  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  if (shouldDisableCaching(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|map|txt|xml)$).*)",
  ],
};
