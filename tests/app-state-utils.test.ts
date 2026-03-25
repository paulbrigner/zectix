import { describe, expect, it } from "vitest";
import type { CheckoutSession } from "@/lib/app-state/types";
import {
  applyDerivedCheckoutSessionState,
  cipherPayStatusFromEvent,
  hasCoreSetup,
  maskSecretPreview,
  normalizeEmailAddress,
} from "@/lib/app-state/utils";
import { makeCheckoutSession } from "@/tests/test-helpers";

function makeSession(overrides: Partial<CheckoutSession> = {}) {
  return makeCheckoutSession(overrides);
}

describe("app-state utilities", () => {
  it("normalizes email addresses and secret previews", () => {
    expect(normalizeEmailAddress(" Jordan@Example.com ")).toBe(
      "jordan@example.com",
    );
    expect(maskSecretPreview("secret-value")).toBe("secret••••alue");
  });

  it("maps cipherpay status events and local expiry", () => {
    expect(cipherPayStatusFromEvent("invoice.created")).toBe("draft");
    expect(cipherPayStatusFromEvent("subscription.renewed")).toBe(
      "confirmed",
    );
    expect(cipherPayStatusFromEvent("unknown.event", "pending")).toBe(
      "pending",
    );

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

  it("checks whether the core setup is complete", () => {
    expect(
      hasCoreSetup({
        api_key: "cipherpay",
        luma_api_key: "luma",
      }),
    ).toBe(true);
    expect(
      hasCoreSetup({
        api_key: "cipherpay",
        luma_api_key: null,
      }),
    ).toBe(false);
    expect(
      hasCoreSetup({
        has_api_key: true,
        has_luma_api_key: true,
      }),
    ).toBe(true);
  });
});
