import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConsumeOpsLoginRateLimit = vi.fn();
const mockConsumeTenantOnboardingRateLimit = vi.fn();
const mockDeleteAdminMagicLinkToken = vi.fn();
const mockDeleteTenantMagicLinkToken = vi.fn();
const mockListTenantsByContactEmail = vi.fn();
const mockPutAdminAuditEvent = vi.fn();
const mockPutAdminMagicLinkToken = vi.fn();
const mockPutTenantMagicLinkToken = vi.fn();
const mockListSelfServeTenantsForEmail = vi.fn();
const mockCreateTenant = vi.fn();
const mockSendAdminMagicLinkEmail = vi.fn();
const mockSendTenantMagicLinkEmail = vi.fn();
const mockIsAdminAuthEnabled = vi.fn();
const mockGetAdminAuthMode = vi.fn();
const mockIsAllowedAdminLoginEmail = vi.fn();
const mockCreateAdminMagicLinkTokenHash = vi.fn();
const mockCreateAdminMagicLinkTokenValue = vi.fn();
const mockIsTenantEmailAuthEnabled = vi.fn();
const mockCreateTenantMagicLinkTokenHash = vi.fn();
const mockCreateTenantMagicLinkTokenValue = vi.fn();
const mockRedirectToPath = vi.fn((path: string) => {
  return new Response(null, {
    status: 303,
    headers: {
      Location: path,
    },
  });
});
const mockCreateRequestId = vi.fn(() => "req_test");
const mockLogEvent = vi.fn();
const mockAuthAuditEmailMetadata = vi.fn((email: string) => ({ email }));
const mockSummarizeAuthRequestHeaders = vi.fn(() => null);
const mockEnsureSameOriginMutation = vi.fn(() => null);
const mockGetTrustedIpAddress = vi.fn(() => "203.0.113.10");
const mockCookies = vi.fn();

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/app-state/state", () => ({
  consumeOpsLoginRateLimit: mockConsumeOpsLoginRateLimit,
  consumeTenantOnboardingRateLimit: mockConsumeTenantOnboardingRateLimit,
  deleteAdminMagicLinkToken: mockDeleteAdminMagicLinkToken,
  deleteTenantMagicLinkToken: mockDeleteTenantMagicLinkToken,
  listTenantsByContactEmail: mockListTenantsByContactEmail,
  putAdminAuditEvent: mockPutAdminAuditEvent,
  putAdminMagicLinkToken: mockPutAdminMagicLinkToken,
  putTenantMagicLinkToken: mockPutTenantMagicLinkToken,
}));

vi.mock("@/lib/tenancy/service", () => ({
  createTenant: mockCreateTenant,
  listSelfServeTenantsForEmail: mockListSelfServeTenantsForEmail,
}));

vi.mock("@/lib/tenant-auth-email", () => ({
  sendTenantMagicLinkEmail: mockSendTenantMagicLinkEmail,
}));

vi.mock("@/lib/admin-auth-email", () => ({
  sendAdminMagicLinkEmail: mockSendAdminMagicLinkEmail,
}));

vi.mock("@/lib/tenant-auth", () => ({
  createTenantMagicLinkTokenHash: mockCreateTenantMagicLinkTokenHash,
  createTenantMagicLinkTokenValue: mockCreateTenantMagicLinkTokenValue,
  isTenantEmailAuthEnabled: mockIsTenantEmailAuthEnabled,
}));

vi.mock("@/lib/admin-auth", () => ({
  ADMIN_MAGIC_LINK_TTL_SECONDS: 900,
  ADMIN_SESSION_COOKIE: "zectix_admin",
  createAdminMagicLinkTokenHash: mockCreateAdminMagicLinkTokenHash,
  createAdminMagicLinkTokenValue: mockCreateAdminMagicLinkTokenValue,
  createAdminSessionToken: vi.fn(() => "session_token"),
  getAdminAuthMode: mockGetAdminAuthMode,
  isAdminAuthEnabled: mockIsAdminAuthEnabled,
  isAllowedAdminLoginEmail: mockIsAllowedAdminLoginEmail,
  verifyAdminPassword: vi.fn(() => false),
}));

vi.mock("@/lib/admin-auth-server", () => ({
  adminSessionCookieOptions: vi.fn(() => ({ httpOnly: true })),
}));

vi.mock("@/lib/http", () => ({
  redirectToPath: mockRedirectToPath,
}));

vi.mock("@/lib/observability", () => ({
  createRequestId: mockCreateRequestId,
  logEvent: mockLogEvent,
}));

vi.mock("@/lib/privacy", () => ({
  authAuditEmailMetadata: mockAuthAuditEmailMetadata,
  summarizeAuthRequestHeaders: mockSummarizeAuthRequestHeaders,
}));

vi.mock("@/lib/request-security", () => ({
  ensureSameOriginMutation: mockEnsureSameOriginMutation,
  getTrustedIpAddress: mockGetTrustedIpAddress,
}));

const { POST: postDashboardLogin } = await import("@/app/api/dashboard/login/route");
const { POST: postDashboardStart } = await import("@/app/api/dashboard/start/route");
const { POST: postOpsLogin } = await import("@/app/api/ops/login/route");

function makeFormRequest(url: string, fields: Record<string, string>) {
  return new Request(url, {
    method: "POST",
    headers: {
      origin: "https://zectix.com",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields),
  });
}

describe("auth route email validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockConsumeOpsLoginRateLimit.mockResolvedValue({
      ok: true,
      retry_after_seconds: null,
      reason: null,
    });
    mockConsumeTenantOnboardingRateLimit.mockResolvedValue({
      ok: true,
      retry_after_seconds: null,
      reason: null,
    });
    mockIsTenantEmailAuthEnabled.mockReturnValue(true);
    mockIsAdminAuthEnabled.mockReturnValue(true);
    mockGetAdminAuthMode.mockReturnValue("email");
    mockEnsureSameOriginMutation.mockReturnValue(null);
    mockGetTrustedIpAddress.mockReturnValue("203.0.113.10");
    mockCookies.mockResolvedValue({
      set: vi.fn(),
    });
  });

  it("rejects malformed tenant login emails before tenant lookup or send", async () => {
    const response = await postDashboardLogin(
      makeFormRequest("https://zectix.com/api/dashboard/login", {
        email: "foo@",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/dashboard/login");
    expect(response.headers.get("location")).toContain("error=invalid_email");
    expect(mockListSelfServeTenantsForEmail).not.toHaveBeenCalled();
    expect(mockSendTenantMagicLinkEmail).not.toHaveBeenCalled();
  });

  it("rejects subtly malformed tenant login emails", async () => {
    const response = await postDashboardLogin(
      makeFormRequest("https://zectix.com/api/dashboard/login", {
        email: "foo..bar@example.com",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/dashboard/login");
    expect(response.headers.get("location")).toContain("error=invalid_email");
    expect(mockListSelfServeTenantsForEmail).not.toHaveBeenCalled();
    expect(mockSendTenantMagicLinkEmail).not.toHaveBeenCalled();
  });

  it("rejects malformed tenant signup emails before tenant creation or send", async () => {
    const response = await postDashboardStart(
      makeFormRequest("https://zectix.com/api/dashboard/start", {
        name: "Acme Org",
        email: "@@@@",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/dashboard/start");
    expect(response.headers.get("location")).toContain("error=invalid_email");
    expect(mockListTenantsByContactEmail).not.toHaveBeenCalled();
    expect(mockCreateTenant).not.toHaveBeenCalled();
    expect(mockSendTenantMagicLinkEmail).not.toHaveBeenCalled();
  });

  it("rejects malformed ops login emails before allowlist checks or send", async () => {
    const response = await postOpsLogin(
      makeFormRequest("https://zectix.com/api/ops/login", {
        email: "@",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/ops/login");
    expect(response.headers.get("location")).toContain("error=invalid_email");
    expect(mockIsAllowedAdminLoginEmail).not.toHaveBeenCalled();
    expect(mockSendAdminMagicLinkEmail).not.toHaveBeenCalled();
  });
});
