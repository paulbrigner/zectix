function readNonNegativeIntegerEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export const DEFAULT_TENANT_SERVICE_FEE_BPS = 33;
export const DEFAULT_TENANT_SETTLEMENT_THRESHOLD_ZATOSHIS = 1_000_000;

export function defaultTenantServiceFeeBps() {
  return readNonNegativeIntegerEnv(
    "TENANT_DEFAULT_SERVICE_FEE_BPS",
    DEFAULT_TENANT_SERVICE_FEE_BPS,
  );
}

export function defaultTenantSettlementThresholdZatoshis() {
  return readNonNegativeIntegerEnv(
    "TENANT_DEFAULT_SETTLEMENT_THRESHOLD_ZATOSHIS",
    DEFAULT_TENANT_SETTLEMENT_THRESHOLD_ZATOSHIS,
  );
}
