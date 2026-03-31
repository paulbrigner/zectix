import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingCycle, UsageLedgerEntry } from "@/lib/app-state/types";
import { makeCheckoutSession, makeTenant } from "@/tests/test-helpers";

const mockBuildBillingReportRows = vi.fn();
const mockGetBillingCycle = vi.fn();
const mockGetTenant = vi.fn();
const mockGetUsageLedgerEntryBySession = vi.fn();
const mockListBillingAdjustmentsByCycle = vi.fn();
const mockListBillingCyclesByTenant = vi.fn();
const mockListSessionsByTenant = vi.fn();
const mockListTenants = vi.fn();
const mockListUsageLedgerEntriesByTenantCycle = vi.fn();
const mockPutBillingAdjustment = vi.fn();
const mockPutBillingCycle = vi.fn();
const mockPutUsageLedgerEntry = vi.fn();
const mockPutUsageLedgerEntryIfAbsent = vi.fn();
const mockUpdateBillingCycle = vi.fn();

vi.mock("@/lib/app-state/state", () => ({
  buildBillingReportRows: mockBuildBillingReportRows,
  getBillingCycle: mockGetBillingCycle,
  getTenant: mockGetTenant,
  getUsageLedgerEntryBySession: mockGetUsageLedgerEntryBySession,
  listBillingAdjustmentsByCycle: mockListBillingAdjustmentsByCycle,
  listBillingCyclesByTenant: mockListBillingCyclesByTenant,
  listSessionsByTenant: mockListSessionsByTenant,
  listTenants: mockListTenants,
  listUsageLedgerEntriesByTenantCycle: mockListUsageLedgerEntriesByTenantCycle,
  putBillingAdjustment: mockPutBillingAdjustment,
  putBillingCycle: mockPutBillingCycle,
  putUsageLedgerEntry: mockPutUsageLedgerEntry,
  putUsageLedgerEntryIfAbsent: mockPutUsageLedgerEntryIfAbsent,
  updateBillingCycle: mockUpdateBillingCycle,
}));

const { ensureUsageLedgerEntryForSession } = await import(
  "@/lib/billing/usage-ledger"
);

function makeBillingCycle(overrides: Partial<BillingCycle> = {}): BillingCycle {
  return {
    billing_cycle_id: "tenant_123:2026-03",
    tenant_id: "tenant_123",
    billing_period: "2026-03",
    period_start: "2026-03-01T00:00:00.000Z",
    period_end: "2026-03-31T23:59:59.999Z",
    grace_until: "2026-04-07T23:59:59.999Z",
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
    created_at: "2026-03-24T12:00:00.000Z",
    updated_at: "2026-03-24T12:00:00.000Z",
    ...overrides,
  };
}

function makeUsageLedgerEntry(
  overrides: Partial<UsageLedgerEntry> = {},
): UsageLedgerEntry {
  return {
    usage_entry_id: "usage_123",
    tenant_id: "tenant_123",
    calendar_connection_id: "calendar_123",
    session_id: "session_123",
    cipherpay_invoice_id: "invoice_123",
    event_api_id: "event_123",
    gross_zatoshis: 1_000_000,
    service_fee_bps: 450,
    service_fee_zatoshis: 45_000,
    recognized_at: "2026-03-24T12:00:00.000Z",
    billing_period: "2026-03",
    billing_cycle_id: "tenant_123:2026-03",
    status: "billable",
    ...overrides,
  };
}

describe("ensureUsageLedgerEntryForSession", () => {
  let cycleRef: BillingCycle | null;
  let entryRef: UsageLedgerEntry | null;

  beforeEach(() => {
    cycleRef = null;
    entryRef = null;

    mockBuildBillingReportRows.mockReset();
    mockGetBillingCycle.mockReset();
    mockGetTenant.mockReset();
    mockGetUsageLedgerEntryBySession.mockReset();
    mockListBillingAdjustmentsByCycle.mockReset();
    mockListBillingCyclesByTenant.mockReset();
    mockListSessionsByTenant.mockReset();
    mockListTenants.mockReset();
    mockListUsageLedgerEntriesByTenantCycle.mockReset();
    mockPutBillingAdjustment.mockReset();
    mockPutBillingCycle.mockReset();
    mockPutUsageLedgerEntry.mockReset();
    mockPutUsageLedgerEntryIfAbsent.mockReset();
    mockUpdateBillingCycle.mockReset();

    mockGetTenant.mockResolvedValue(makeTenant());
    mockGetBillingCycle.mockImplementation(async () => cycleRef);
    mockPutBillingCycle.mockImplementation(async (cycle) => {
      cycleRef = cycle;
      return cycle;
    });
    mockPutUsageLedgerEntryIfAbsent.mockImplementation(async (entry) => {
      entryRef = entry;
      return entry;
    });
    mockPutUsageLedgerEntry.mockImplementation(async (entry) => {
      entryRef = entry;
      return entry;
    });
    mockListUsageLedgerEntriesByTenantCycle.mockImplementation(async () =>
      entryRef ? [entryRef] : [],
    );
    mockListBillingAdjustmentsByCycle.mockResolvedValue([]);
    mockListBillingCyclesByTenant.mockResolvedValue([]);
    mockListSessionsByTenant.mockResolvedValue([]);
    mockListTenants.mockResolvedValue([]);
    mockBuildBillingReportRows.mockReturnValue([]);
  });

  it("creates a new usage ledger entry through an idempotent create path", async () => {
    const session = makeCheckoutSession({
      registered_at: "2026-03-24T12:00:00.000Z",
      service_fee_bps_snapshot: 33,
      service_fee_zatoshis_snapshot: 3_300,
    });
    mockGetUsageLedgerEntryBySession.mockResolvedValue(null);

    const saved = await ensureUsageLedgerEntryForSession(session);

    expect(mockPutUsageLedgerEntryIfAbsent).toHaveBeenCalledTimes(1);
    expect(mockPutUsageLedgerEntry).not.toHaveBeenCalled();
    expect(saved.session_id).toBe(session.session_id);
    expect(saved.service_fee_bps).toBe(33);
    expect(saved.service_fee_zatoshis).toBe(3_300);
    expect(mockPutBillingCycle).toHaveBeenCalled();
  });

  it("reuses the existing session ledger entry when the create transaction loses a race", async () => {
    const session = makeCheckoutSession({
      registered_at: "2026-03-24T12:00:00.000Z",
      service_fee_bps_snapshot: 33,
      service_fee_zatoshis_snapshot: 3_300,
    });
    const existingEntry = makeUsageLedgerEntry({
      usage_entry_id: "usage_existing",
      service_fee_bps: 33,
      service_fee_zatoshis: 3_300,
    });
    cycleRef = makeBillingCycle({
      billing_cycle_id: existingEntry.billing_cycle_id,
      billing_period: existingEntry.billing_period,
      tenant_id: existingEntry.tenant_id,
    });
    entryRef = existingEntry;

    mockGetUsageLedgerEntryBySession
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingEntry);
    mockPutUsageLedgerEntryIfAbsent.mockRejectedValueOnce(
      Object.assign(new Error("already exists"), {
        name: "UsageLedgerSessionConflictError",
      }),
    );

    const saved = await ensureUsageLedgerEntryForSession(session);

    expect(mockPutUsageLedgerEntryIfAbsent).toHaveBeenCalledTimes(1);
    expect(mockPutUsageLedgerEntry).toHaveBeenCalledTimes(1);
    expect(mockPutUsageLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: session.session_id,
        usage_entry_id: existingEntry.usage_entry_id,
      }),
    );
    expect(saved.usage_entry_id).toBe(existingEntry.usage_entry_id);
  });
});
