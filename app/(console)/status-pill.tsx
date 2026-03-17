import { cipherPayStatusFromEvent } from "@/lib/test-harness/utils";
import type { CipherPaySessionStatus } from "@/lib/test-harness/types";

function statusClassName(status: CipherPaySessionStatus) {
  if (status === "confirmed") return "test-status test-status-confirmed";
  if (status === "detected") return "test-status test-status-detected";
  if (status === "underpaid" || status === "pending" || status === "draft") {
    return "test-status test-status-pending";
  }
  if (status === "expired" || status === "refunded") {
    return "test-status test-status-expired";
  }
  return "test-status";
}

export function TestStatusPill({ status }: { status: CipherPaySessionStatus }) {
  const normalized = cipherPayStatusFromEvent(status, status);
  return (
    <span className={statusClassName(normalized)}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

