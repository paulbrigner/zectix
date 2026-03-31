import Link from "next/link";
import { ConsoleSection } from "@/components/ConsoleSection";
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
  const tabs: Array<{
    copy: string;
    disabled: boolean;
    href: string;
    id: TenantConnectionsTab;
    label: string;
  }> = [
    {
      copy: onboardingComplete ? "Completed." : "Finish onboarding in a focused sequence.",
      href: setupTabPath,
      id: "setup",
      label: "Setup",
      disabled: onboardingComplete && !allowSetupTab,
    },
    {
      copy: "Connect calendars and refresh mirrored inventory.",
      href: lumaTabPath,
      id: "luma",
      label: "Luma",
      disabled: onboardingIncomplete && activeTab !== "luma",
    },
    {
      copy: "Attach and validate your live checkout account.",
      href: cipherPayTabPath,
      id: "cipherpay",
      label: "CipherPay",
      disabled: onboardingIncomplete && activeTab !== "cipherpay",
    },
  ];

  return (
    <div className="console-page-body">
      <ConsoleSection
        description="Complete setup and manage your Luma and CipherPay connections without mixing onboarding steps with everyday event review."
        title="Connections"
      >

        <nav
          aria-label="Connections sections"
          className="console-tab-bar"
        >
          {tabs.map((tab) => (
            tab.disabled ? (
              <span
                aria-disabled="true"
                className="console-tab-link console-tab-link-disabled"
                key={tab.id}
              >
                <span className="console-tab-link-label">{tab.label}</span>
                <span className="console-tab-link-copy">{tab.copy}</span>
              </span>
            ) : (
              <Link
                className={`console-tab-link${
                  activeTab === tab.id ? " console-tab-link-active" : ""
                }`}
                href={tab.href}
                key={tab.id}
              >
                <span className="console-tab-link-label">{tab.label}</span>
                <span className="console-tab-link-copy">{tab.copy}</span>
              </Link>
            )
          ))}
        </nav>

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
      </ConsoleSection>
    </div>
  );
}
