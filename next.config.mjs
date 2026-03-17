import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultBasePath = process.env.NODE_ENV === "production" ? "" : "/lumazcash";

function normalizeBasePath(value) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }

  const normalized = trimmed.replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "";
}

const basePath = normalizeBasePath(process.env.APP_BASE_PATH ?? defaultBasePath);

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_APP_BASE_PATH: basePath,
  },
  turbopack: {
    root: dirname,
  },
};

export default nextConfig;
