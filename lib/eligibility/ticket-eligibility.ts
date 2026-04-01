import { supportedTicketCurrencies } from "@/lib/app-state/utils";
import type { TicketMirror } from "@/lib/app-state/types";

type TicketEligibilityInput = Pick<
  TicketMirror,
  | "active"
  | "currency"
  | "amount"
  | "public_checkout_requested"
>;

export type TicketEligibilityResult = {
  automatic_eligibility_status: "eligible" | "ineligible";
  automatic_eligibility_reasons: string[];
  zcash_enabled: boolean;
  zcash_enabled_reason: string;
};

export function evaluateTicketEligibility(
  ticket: TicketEligibilityInput,
): TicketEligibilityResult {
  const automaticReasons: string[] = [];
  if (!ticket.active) {
    automaticReasons.push("Ticket is not active in Luma.");
  }

  if (ticket.amount == null || ticket.amount <= 0) {
    automaticReasons.push("Ticket does not expose a fixed positive price.");
  }

  if (!ticket.currency || !supportedTicketCurrencies().has(ticket.currency.toUpperCase())) {
    automaticReasons.push("Ticket currency is not supported for v1 checkout.");
  }

  const automaticEligible = automaticReasons.length === 0;
  const zcashEnabled = automaticEligible;
  const requestedForPublicCheckout = ticket.public_checkout_requested;

  return {
    automatic_eligibility_status: automaticEligible ? "eligible" : "ineligible",
    automatic_eligibility_reasons: automaticReasons,
    zcash_enabled: requestedForPublicCheckout && zcashEnabled,
    zcash_enabled_reason: !requestedForPublicCheckout
      ? "Public checkout is turned off for this ticket."
      : zcashEnabled
        ? "Enabled for public Zcash checkout."
        : automaticReasons[0] || "Ticket is not eligible for public Zcash checkout.",
  };
}
