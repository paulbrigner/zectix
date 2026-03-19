import { cipherPayStatusFromEvent } from "@/lib/app-state/utils";
import type { CipherPaySessionStatus } from "@/lib/app-state/types";

function statusClassName(status: CipherPaySessionStatus) {
  if (status === "confirmed") return "console-status console-status-confirmed";
  if (status === "detected") return "console-status console-status-detected";
  if (status === "underpaid" || status === "pending" || status === "draft") {
    return "console-status console-status-pending";
  }
  if (status === "expired" || status === "refunded") {
    return "console-status console-status-expired";
  }
  return "console-status";
}

export function TestStatusPill({ status }: { status: CipherPaySessionStatus }) {
  const normalized = cipherPayStatusFromEvent(status, status);
  return (
    <span className={statusClassName(normalized)}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

