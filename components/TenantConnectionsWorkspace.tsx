import Link from "next/link";
import type { TenantOpsDetail } from "@/lib/tenancy/service";
import { buildOnboardingChecklist } from "@/lib/tenant-self-serve";
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
  checklistComplete: boolean,
): TenantConnectionsTab {
  switch (readSearchValue(value)) {
    case "setup":
      return "setup";
    case "cipherpay":
      return "cipherpay";
    case "luma":
      return "luma";
    default:
      return checklistComplete ? "luma" : "setup";
  }
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
  const onboardingChecklist = buildOnboardingChecklist(detail);
  const checklistComplete = onboardingChecklist.every((item) => item.complete);
  const activeTab = readConnectionsTab(searchParams.tab, checklistComplete);
  const setupTabPath = buildConnectionsTabHref(connectionsBasePath, "setup");
  const lumaTabPath = buildConnectionsTabHref(connectionsBasePath, "luma");
  const cipherPayTabPath = buildConnectionsTabHref(
    connectionsBasePath,
    "cipherpay",
  );
  const tabs: Array<{
    copy: string;
    href: string;
    id: TenantConnectionsTab;
    label: string;
  }> = [
    {
      copy: "Finish onboarding in a focused sequence.",
      href: setupTabPath,
      id: "setup",
      label: "Setup",
    },
    {
      copy: "Connect calendars and refresh mirrored inventory.",
      href: lumaTabPath,
      id: "luma",
      label: "Luma",
    },
    {
      copy: "Attach and validate your live checkout account.",
      href: cipherPayTabPath,
      id: "cipherpay",
      label: "CipherPay",
    },
  ];

  return (
    <div className="console-page-body">
      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Connections</h2>
            <p className="subtle-text">
              Complete setup and manage your Luma and CipherPay connections
              without mixing onboarding steps with everyday event review.
            </p>
          </div>
        </div>

        <nav
          aria-label="Connections sections"
          className="console-tab-bar"
        >
          {tabs.map((tab) => (
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
            />
          ) : null}
          {activeTab === "cipherpay" ? (
            <TenantConnectionsCipherPayTab
              cipherPayTabPath={cipherPayTabPath}
              detail={detail}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
