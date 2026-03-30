import type { EventMirrorStatus } from "@/lib/app-state/types";

export type EventCheckoutInput = {
  enabled_ticket_count: number;
  public_checkout_requested: boolean;
  sync_status: EventMirrorStatus;
};

export type EventCheckoutResult = {
  zcash_enabled: boolean;
  zcash_enabled_reason: string;
};

export function evaluateEventCheckoutState(
  input: EventCheckoutInput,
): EventCheckoutResult {
  if (input.sync_status === "hidden") {
    return {
      zcash_enabled: false,
      zcash_enabled_reason: "Event no longer appears in the latest Luma sync.",
    };
  }

  if (input.sync_status === "canceled") {
    return {
      zcash_enabled: false,
      zcash_enabled_reason: "Event is canceled in Luma.",
    };
  }

  if (input.sync_status === "error") {
    return {
      zcash_enabled: false,
      zcash_enabled_reason: "Event sync needs attention before public checkout can open.",
    };
  }

  if (!input.public_checkout_requested) {
    return {
      zcash_enabled: false,
      zcash_enabled_reason: "Public checkout is turned off for this event.",
    };
  }

  if (input.enabled_ticket_count > 0) {
    return {
      zcash_enabled: true,
      zcash_enabled_reason: "At least one ticket is enabled for Zcash checkout.",
    };
  }

  return {
    zcash_enabled: false,
    zcash_enabled_reason: "No tickets are currently enabled for public Zcash checkout.",
  };
}
