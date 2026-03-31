import { describe, expect, it } from "vitest";
import type { BillingCycle } from "@/lib/app-state/types";
import {
  billingWindowForPeriod,
  calculateOutstandingZatoshis,
  deriveBillingCycleStatus,
} from "@/lib/billing/cycles";

function makeBillingCycle(overrides: Partial<BillingCycle> = {}): BillingCycle {
  return {
    billing_cycle_id: "tenant_123:2026-03",
    tenant_id: "tenant_123",
    billing_period: "2026-03",
    period_start: "2026-03-01T00:00:00.000Z",
    period_end: "2026-04-01T00:00:00.000Z",
    grace_until: "2026-04-08T00:00:00.000Z",
    status: "open",
    recognized_session_count: 0,
    gross_zatoshis: 0,
    service_fee_zatoshis: 0,
    credited_zatoshis: 0,
    waived_zatoshis: 0,
    outstanding_zatoshis: 0,
    invoice_reference: null,
    settlement_txid: null,
    invoiced_at: null,
    paid_at: null,
    last_reconciled_at: null,
    created_at: "2026-03-01T00:00:00.000Z",
    updated_at: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("billingWindowForPeriod", () => {
  it("builds the expected window for a valid billing period", () => {
    expect(billingWindowForPeriod("2026-03", 7)).toEqual({
      period_start: "2026-03-01T00:00:00.000Z",
      period_end: "2026-04-01T00:00:00.000Z",
      grace_until: "2026-04-08T00:00:00.000Z",
    });
  });

  it("rejects malformed billing period strings instead of silently falling back", () => {
    expect(() => billingWindowForPeriod("2026-3", 7)).toThrow(
      "Invalid billing period: 2026-3",
    );
    expect(() => billingWindowForPeriod("not-a-period", 7)).toThrow(
      "Invalid billing period: not-a-period",
    );
    expect(() => billingWindowForPeriod("2026-13", 7)).toThrow(
      "Invalid billing period: 2026-13",
    );
  });

  it("handles leap-year February and month boundaries correctly", () => {
    expect(billingWindowForPeriod("2024-02", 2)).toEqual({
      period_start: "2024-02-01T00:00:00.000Z",
      period_end: "2024-03-01T00:00:00.000Z",
      grace_until: "2024-03-03T00:00:00.000Z",
    });
  });
});

describe("calculateOutstandingZatoshis", () => {
  it("subtracts credits and waivers from service fees", () => {
    expect(
      calculateOutstandingZatoshis({
        service_fee_zatoshis: 10_000,
        credited_zatoshis: 2_500,
        waived_zatoshis: 1_500,
      }),
    ).toBe(6_000);
  });

  it("clamps negative inputs and never returns less than zero", () => {
    expect(
      calculateOutstandingZatoshis({
        service_fee_zatoshis: -1,
        credited_zatoshis: 0,
        waived_zatoshis: 0,
      }),
    ).toBe(0);

    expect(
      calculateOutstandingZatoshis({
        service_fee_zatoshis: 5_000,
        credited_zatoshis: 10_000,
        waived_zatoshis: -500,
      }),
    ).toBe(0);
  });
});

describe("deriveBillingCycleStatus", () => {
  it("treats an explicitly paid cycle as paid", () => {
    const cycle = makeBillingCycle({
      status: "invoiced",
      outstanding_zatoshis: 1_000,
      paid_at: "2026-04-02T00:00:00.000Z",
    });

    expect(deriveBillingCycleStatus(cycle, "active")).toBe("paid");
  });

  it("keeps invoiced cycles invoiced during the grace period", () => {
    const cycle = makeBillingCycle({
      status: "open",
      invoice_reference: "inv_123",
      invoiced_at: "2026-04-01T00:00:00.000Z",
      outstanding_zatoshis: 1_000,
      grace_until: "2026-04-08T00:00:00.000Z",
    });

    expect(
      deriveBillingCycleStatus(cycle, "active", "2026-04-08T00:00:00.000Z"),
    ).toBe("invoiced");
  });

  it("moves unpaid cycles past due only after the grace period boundary", () => {
    const cycle = makeBillingCycle({
      status: "open",
      outstanding_zatoshis: 1_000,
      grace_until: "2026-04-08T00:00:00.000Z",
    });

    expect(
      deriveBillingCycleStatus(cycle, "active", "2026-04-07T23:59:59.999Z"),
    ).toBe("open");
    expect(
      deriveBillingCycleStatus(cycle, "active", "2026-04-08T00:00:00.001Z"),
    ).toBe("past_due");
  });

  it("elevates cycles to suspended when tenant billing is suspended", () => {
    const cycle = makeBillingCycle({
      status: "past_due",
      outstanding_zatoshis: 1_000,
    });

    expect(deriveBillingCycleStatus(cycle, "suspended")).toBe("suspended");
  });

  it("marks invoiced cycles with no outstanding balance as paid", () => {
    const cycle = makeBillingCycle({
      status: "invoiced",
      invoice_reference: "inv_123",
      invoiced_at: "2026-04-01T00:00:00.000Z",
      outstanding_zatoshis: 0,
    });

    expect(deriveBillingCycleStatus(cycle, "active")).toBe("paid");
  });
});
