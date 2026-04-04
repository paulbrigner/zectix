function normalizeBasePath(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }

  const normalized = trimmed.replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "";
}

function stripConfiguredBasePath(pathname: string) {
  const basePath = normalizeBasePath(
    process.env.NEXT_PUBLIC_APP_BASE_PATH || process.env.APP_BASE_PATH || "",
  );
  if (!basePath || !pathname.startsWith(basePath)) {
    return pathname;
  }

  const stripped = pathname.slice(basePath.length);
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

function isEmbedCapablePath(pathname: string) {
  const normalizedPath = stripConfiguredBasePath(pathname);
  return normalizedPath.startsWith("/c/") || normalizedPath.startsWith("/checkout/");
}

export function buildSecurityHeaders(input: {
  pathname: string;
  searchParams?: URLSearchParams;
  isProduction?: boolean;
}) {
  const headers = new Headers();
  const embedMode =
    isEmbedCapablePath(input.pathname) &&
    input.searchParams?.get("embed") === "1";

  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  );
  headers.set("X-Content-Type-Options", "nosniff");

  if (input.isProduction ?? process.env.NODE_ENV === "production") {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  if (embedMode) {
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors *; upgrade-insecure-requests",
    );
  } else {
    headers.set("X-Frame-Options", "DENY");
    headers.set(
      "Content-Security-Policy",
      "frame-ancestors 'none'; upgrade-insecure-requests",
    );
  }

  return headers;
}
