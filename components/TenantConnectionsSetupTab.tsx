import Link from "next/link";
import { activatePublicCheckoutAction } from "@/app/dashboard/actions";
import { ConsoleConfirmDialog } from "@/components/ConsoleConfirmDialog";
import { ConsoleSection } from "@/components/ConsoleSection";
import type { TenantOpsDetail } from "@/lib/tenancy/service";
import { buildOnboardingChecklist } from "@/lib/tenant-self-serve";

type SearchParamValue = string | string[] | undefined;

function withHash(path: string, hash: string) {
  return `${path}#${hash}`;
}

function readSearchValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function readOnboardingCompletionNotice(
  searchParams: Record<string, SearchParamValue>,
) {
  if (readSearchValue(searchParams.onboarding_complete) !== "1") {
    return null;
  }

  const eventHref = readSearchValue(searchParams.onboarding_event_href) || null;
  const eventName = readSearchValue(searchParams.onboarding_event_name) || null;

  return {
    eventHref:
      eventHref && eventHref.startsWith("/c/") ? eventHref : null,
    eventName,
  };
}

export function TenantConnectionsSetupTab({
  detail,
  searchParams,
  setupTabPath,
}: {
  detail: TenantOpsDetail;
  searchParams: Record<string, SearchParamValue>;
  setupTabPath: string;
}) {
  const onboardingChecklist = buildOnboardingChecklist(detail);
  const onboardingCompletionNotice =
    readOnboardingCompletionNotice(searchParams);
  const setupError = readSearchValue(searchParams.setup_error);
  const activationStep = onboardingChecklist.find(
    (item) => item.stepId === "activate_public_checkout",
  );
  const activationStepIndex = onboardingChecklist.findIndex(
    (item) => item.stepId === "activate_public_checkout",
  );
  const activationReady = onboardingChecklist
    .slice(0, activationStepIndex)
    .every((item) => item.complete);
  const activationComplete = activationStep?.complete ?? false;

  return (
    <div className="console-content console-anchor-target" id="setup-checklist">
      {setupError ? (
        <ConsoleSection
          eyebrow={<p className="console-kpi-label">Setup issue</p>}
          role="alert"
          title={setupError}
          titleAs="h3"
        >
          <p className="subtle-text">
            The calendar was saved, but the initial validation and mirror refresh still
            need attention.
          </p>
        </ConsoleSection>
      ) : null}

      {onboardingCompletionNotice ? (
        <ConsoleSection
          actions={
            onboardingCompletionNotice.eventHref ? (
              <Link
                className="button button-small"
                href={onboardingCompletionNotice.eventHref}
              >
                Open public event
              </Link>
            ) : null
          }
          className="tenant-onboarding-complete-banner"
          eyebrow={<p className="console-kpi-label">Onboarding complete</p>}
          description="Every organizer setup step is complete and public checkout is now active for your published event."
          role="status"
          title="Congratulations, your first public checkout is live."
          titleAs="h3"
        >
          {onboardingCompletionNotice.eventName ? (
            <p className="subtle-text">
              Public event: {onboardingCompletionNotice.eventName}
            </p>
          ) : null}
        </ConsoleSection>
      ) : null}

      {!activationComplete ? (
        <ConsoleSection
          description={
            activationReady
              ? "All prerequisites are complete. Activate public checkout to make your organizer reachable."
              : "Complete all previous setup steps before activating public checkout."
          }
          title="Activate public checkout"
          titleAs="h3"
        >
          <div
            className="button-row console-anchor-target"
            id="activate-public-checkout"
          >
            {activationReady ? (
              <ConsoleConfirmDialog
                action={activatePublicCheckoutAction}
                confirmClassName="button button-small"
                confirmLabel="Activate public checkout"
                description="This makes your organizer workspace publicly reachable. Events and tickets still stay hidden until you enable them in the Events workspace."
                title="Activate public checkout?"
                triggerClassName="button button-small"
                triggerLabel="Activate public checkout"
              >
                <input
                  name="tenant_slug"
                  type="hidden"
                  value={detail.tenant.slug}
                />
                <input
                  name="redirect_to"
                  type="hidden"
                  value={withHash(setupTabPath, "activate-public-checkout")}
                />
              </ConsoleConfirmDialog>
            ) : (
              <button
                className="button button-secondary button-small"
                disabled
                type="button"
              >
                Finish earlier steps first
              </button>
            )}
          </div>
        </ConsoleSection>
      ) : null}
    </div>
  );
}
