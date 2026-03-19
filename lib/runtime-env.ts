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
  return (
    asNonEmptyString(process.env.SESSION_VIEWER_SECRET) ||
    (isProductionRuntime()
      ? asNonEmptyString(process.env.ADMIN_SESSION_SECRET)
      : null)
  );
}

export function isSessionViewerProtectionEnabled() {
  return Boolean(getSessionViewerSecret());
}
