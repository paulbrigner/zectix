import { TenantDashboardHeaderMenu } from "@/components/TenantDashboardHeaderMenu";
import { appPath } from "@/lib/app-paths";

export function TenantDashboardShellHeader({
  organizationName,
  basePath,
  onboardingIncomplete,
}: {
  organizationName: string;
  basePath: string;
  onboardingIncomplete: boolean;
}) {
  return (
    <header className="console-section tenant-dashboard-header">
      <div className="tenant-dashboard-header-top">
        <div className="tenant-dashboard-header-brand">
          <h2 className="tenant-dashboard-header-name">{organizationName}</h2>
        </div>

        <TenantDashboardHeaderMenu
          basePath={basePath}
          logoutAction={appPath("/api/dashboard/logout")}
          onboardingIncomplete={onboardingIncomplete}
        />
      </div>
    </header>
  );
}
