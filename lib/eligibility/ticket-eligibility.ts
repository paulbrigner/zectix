import { supportedTicketCurrencies } from "@/lib/app-state/utils";
import type { TicketMirror } from "@/lib/app-state/types";

type TicketEligibilityInput = Pick<
  TicketMirror,
  | "active"
  | "currency"
  | "amount"
  | "confirmed_fixed_price"
  | "confirmed_no_approval_required"
  | "confirmed_no_extra_required_questions"
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
  const operatorEligible =
    ticket.confirmed_fixed_price &&
    ticket.confirmed_no_approval_required &&
    ticket.confirmed_no_extra_required_questions;

  if (!ticket.confirmed_fixed_price) {
    automaticReasons.push("Operator has not confirmed the ticket is fixed-price.");
  }

  if (!ticket.confirmed_no_approval_required) {
    automaticReasons.push("Operator has not confirmed the ticket bypasses approval.");
  }

  if (!ticket.confirmed_no_extra_required_questions) {
    automaticReasons.push(
      "Operator has not confirmed the registration flow avoids extra required questions.",
    );
  }

  const zcashEnabled = automaticEligible && operatorEligible;
  const requestedForPublicCheckout = ticket.public_checkout_requested;

  return {
    automatic_eligibility_status: automaticEligible ? "eligible" : "ineligible",
    automatic_eligibility_reasons: automaticReasons,
    zcash_enabled: requestedForPublicCheckout && zcashEnabled,
    zcash_enabled_reason: !requestedForPublicCheckout
      ? "Public checkout is turned off for this ticket."
      : zcashEnabled
        ? "Enabled for managed Zcash checkout."
        : automaticReasons[0] || "Ticket still needs operator confirmation.",
  };
}
