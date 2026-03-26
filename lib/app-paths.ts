const DEFAULT_DEV_BASE_PATH = "/zectix";

function normalizeAppBasePath(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }

  const normalized = trimmed.replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "";
}

function normalizeAppOrigin(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const normalized = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    return new URL(normalized).origin;
  } catch {
    return null;
  }
}

export const APP_BASE_PATH = normalizeAppBasePath(
  process.env.NEXT_PUBLIC_APP_BASE_PATH ??
    process.env.APP_BASE_PATH ??
    (process.env.NODE_ENV === "production" ? "" : DEFAULT_DEV_BASE_PATH),
);

export const APP_PUBLIC_ORIGIN = normalizeAppOrigin(
  process.env.APP_PUBLIC_ORIGIN ??
    process.env.NEXT_PUBLIC_APP_ORIGIN ??
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL,
);

export function appPath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return APP_BASE_PATH ? `${APP_BASE_PATH}${normalizedPath}` : normalizedPath;
}

export function appOrigin() {
  const value =
    process.env.APP_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() || null;
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function absoluteAppUrl(path: string) {
  const origin = appOrigin();
  if (!origin) {
    throw new Error(
      "APP_ORIGIN must be configured so managed Luma webhooks can reach this service.",
    );
  }

  return new URL(appPath(path), origin).toString();
}

export function appUrl(path: string) {
  if (!APP_PUBLIC_ORIGIN) {
    return null;
  }

  return new URL(appPath(path), `${APP_PUBLIC_ORIGIN}/`).toString();
}
