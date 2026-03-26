import { describe, expect, it, vi } from "vitest";
import type { CheckoutSession } from "@/lib/app-state/types";
import {
  applyDerivedCheckoutSessionState,
  billingPeriodForTimestamp,
  calculateServiceFeeAmount,
  cipherPayStatusFromEvent,
  maskSecretPreview,
  normalizeEmailAddress,
  supportedTicketCurrencies,
} from "@/lib/app-state/utils";
import { evaluateTicketEligibility } from "@/lib/eligibility/ticket-eligibility";
import { makeCheckoutSession, makeTicketMirror } from "@/tests/test-helpers";

function makeSession(overrides: Partial<CheckoutSession> = {}) {
  return makeCheckoutSession(overrides);
}

describe("app-state utilities", () => {
  it("normalizes email addresses, secret previews, and billing periods", () => {
    expect(normalizeEmailAddress(" Jordan@Example.com ")).toBe("jordan@example.com");
    expect(maskSecretPreview("secret-value")).toBe("secret••••alue");
    expect(billingPeriodForTimestamp("2026-03-24T12:00:00.000Z")).toBe("2026-03");
  });

  it("maps cipherpay status events and local expiry", () => {
    expect(cipherPayStatusFromEvent("invoice.created")).toBe("draft");
    expect(cipherPayStatusFromEvent("invoice.confirmed")).toBe("confirmed");
    expect(cipherPayStatusFromEvent("unknown.event", "pending")).toBe("pending");

    const past = "2024-01-01T00:00:00.000Z";
    const future = "2999-01-01T00:00:00.000Z";
    expect(
      applyDerivedCheckoutSessionState(
        makeSession({
          status: "pending",
          cipherpay_expires_at: past,
        }),
      ).status,
    ).toBe("expired");
    expect(
      applyDerivedCheckoutSessionState(
        makeSession({
          status: "pending",
          cipherpay_expires_at: future,
        }),
      ).status,
    ).toBe("pending");
  });

  it("computes service fees and ticket eligibility with operator assertions", () => {
    expect(calculateServiceFeeAmount(25, 450)).toBe(1.13);

    vi.stubEnv("SUPPORTED_TICKET_CURRENCIES", "USD,EUR");
    expect([...supportedTicketCurrencies()]).toEqual(["USD", "EUR"]);

    const eligible = evaluateTicketEligibility(makeTicketMirror());
    expect(eligible.zcash_enabled).toBe(true);

    const ineligible = evaluateTicketEligibility(
      makeTicketMirror({
        confirmed_no_approval_required: false,
      }),
    );
    expect(ineligible.zcash_enabled).toBe(false);
    expect(ineligible.automatic_eligibility_reasons.join(" ")).toMatch(/approval/i);
  });
});
