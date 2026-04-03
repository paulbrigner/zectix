import type { TenantOpsDetail } from "@/lib/tenancy/service";
import {
  hasCompletedTenantOnboarding,
} from "@/lib/tenant-self-serve";
import { TenantConnectionsCipherPayTab } from "@/components/TenantConnectionsCipherPayTab";
import { TenantConnectionsLumaTab } from "@/components/TenantConnectionsLumaTab";
import { TenantConnectionsSetupTab } from "@/components/TenantConnectionsSetupTab";

type SearchParamValue = string | string[] | undefined;
type TenantConnectionsTab = "setup" | "luma" | "cipherpay";

function readSearchValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function readConnectionsTab(
  value: SearchParamValue,
  onboardingComplete: boolean,
  allowSetup: boolean,
): TenantConnectionsTab {
  switch (readSearchValue(value)) {
    case "setup":
      return onboardingComplete && !allowSetup ? "luma" : "setup";
    case "cipherpay":
      return "cipherpay";
    case "luma":
      return "luma";
    default:
      return onboardingComplete ? "luma" : "setup";
  }
}

function hasOnboardingCompletionNotice(
  searchParams: Record<string, SearchParamValue>,
) {
  return readSearchValue(searchParams.onboarding_complete) === "1";
}

function buildConnectionsTabHref(
  connectionsBasePath: string,
  tab: TenantConnectionsTab,
) {
  return `${connectionsBasePath}?tab=${tab}`;
}

export function TenantConnectionsWorkspace({
  detail,
  searchParams,
  tenantBasePath,
}: {
  detail: TenantOpsDetail;
  searchParams: Record<string, SearchParamValue>;
  tenantBasePath: string;
}) {
  const connectionsBasePath = `${tenantBasePath}/connections`;
  const eventsBasePath = `${tenantBasePath}/events`;
  const onboardingComplete = hasCompletedTenantOnboarding(detail.tenant);
  const onboardingIncomplete = !onboardingComplete;
  const allowSetupTab = hasOnboardingCompletionNotice(searchParams);
  const activeTab = readConnectionsTab(
    searchParams.tab,
    onboardingComplete,
    allowSetupTab,
  );
  const setupTabPath = buildConnectionsTabHref(connectionsBasePath, "setup");
  const lumaTabPath = buildConnectionsTabHref(connectionsBasePath, "luma");
  const cipherPayTabPath = buildConnectionsTabHref(
    connectionsBasePath,
    "cipherpay",
  );

  return (
    <div className="console-page-body">
      <div className="console-tab-panel">
        {activeTab === "setup" ? (
          <TenantConnectionsSetupTab
            connectionsBasePath={connectionsBasePath}
            cipherPayTabPath={cipherPayTabPath}
            detail={detail}
            eventsBasePath={eventsBasePath}
            lumaTabPath={lumaTabPath}
            searchParams={searchParams}
            setupTabPath={setupTabPath}
          />
        ) : null}
        {activeTab === "luma" ? (
          <TenantConnectionsLumaTab
            detail={detail}
            eventsBasePath={eventsBasePath}
            lumaTabPath={lumaTabPath}
            onboardingIncomplete={onboardingIncomplete}
            searchParams={searchParams}
            setupTabPath={setupTabPath}
          />
        ) : null}
        {activeTab === "cipherpay" ? (
          <TenantConnectionsCipherPayTab
            cipherPayTabPath={cipherPayTabPath}
            detail={detail}
            onboardingIncomplete={onboardingIncomplete}
            setupTabPath={setupTabPath}
          />
        ) : null}
      </div>
    </div>
  );
}
