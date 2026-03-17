const DEFAULT_DEV_BASE_PATH = "/lumazcash";

function normalizeAppBasePath(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }

  const normalized = trimmed.replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "";
}

export const APP_BASE_PATH = normalizeAppBasePath(
  process.env.NEXT_PUBLIC_APP_BASE_PATH ??
    process.env.APP_BASE_PATH ??
    (process.env.NODE_ENV === "production" ? "" : DEFAULT_DEV_BASE_PATH),
);

export function appPath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return APP_BASE_PATH ? `${APP_BASE_PATH}${normalizedPath}` : normalizedPath;
}

