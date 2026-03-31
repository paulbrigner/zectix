function asNonEmptyString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

export function isExternalSecretManagementEnabled() {
  return isProductionRuntime() && process.env.ALLOW_RUNTIME_SECRET_STORAGE !== "true";
}

export function getSessionViewerSecret() {
  const dedicatedSecret = asNonEmptyString(process.env.SESSION_VIEWER_SECRET);
  if (dedicatedSecret) {
    return dedicatedSecret;
  }

  if (isProductionRuntime()) {
    throw new Error("SESSION_VIEWER_SECRET is required in production.");
  }

  return asNonEmptyString(process.env.ADMIN_SESSION_SECRET);
}

export function isSessionViewerProtectionEnabled() {
  return Boolean(getSessionViewerSecret());
}
