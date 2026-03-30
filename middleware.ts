import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildSecurityHeaders } from "@/lib/security-headers";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const headers = buildSecurityHeaders({
    pathname: request.nextUrl.pathname,
    searchParams: request.nextUrl.searchParams,
  });

  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|map|txt|xml)$).*)",
  ],
};
