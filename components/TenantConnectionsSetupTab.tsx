import Link from "next/link";
import { activatePublicCheckoutAction } from "@/app/dashboard/actions";
import { ConsoleConfirmDialog } from "@/components/ConsoleConfirmDialog";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
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
  connectionsBasePath,
  cipherPayTabPath,
  detail,
  eventsBasePath,
  lumaTabPath,
  searchParams,
  setupTabPath,
}: {
  connectionsBasePath: string;
  cipherPayTabPath: string;
  detail: TenantOpsDetail;
  eventsBasePath: string;
  lumaTabPath: string;
  searchParams: Record<string, SearchParamValue>;
  setupTabPath: string;
}) {
  const onboardingChecklist = buildOnboardingChecklist(detail);
  const onboardingCompletionNotice =
    readOnboardingCompletionNotice(searchParams);
  const completedSteps = onboardingChecklist.filter(
    (item) => item.complete,
  ).length;
  const checklistComplete = completedSteps === onboardingChecklist.length;
  const activationStepIndex = onboardingChecklist.findIndex(
    (item) => item.stepId === "activate_public_checkout",
  );
  const activationReady = onboardingChecklist
    .slice(0, activationStepIndex)
    .every((item) => item.complete);

  function checklistItemHref(
    stepId: (typeof onboardingChecklist)[number]["stepId"],
  ) {
    switch (stepId) {
      case "draft_organizer_created":
        return withHash(setupTabPath, "setup-checklist");
      case "connect_luma_calendar":
        return withHash(lumaTabPath, "connect-luma-calendar");
      case "attach_cipherpay":
        return withHash(cipherPayTabPath, "connect-cipherpay");
      case "publish_event_and_ticket":
        return `${eventsBasePath}#event-review-queue`;
      case "activate_public_checkout":
        return withHash(setupTabPath, "activate-public-checkout");
      default:
        return connectionsBasePath;
    }
  }

  return (
    <div className="console-content console-anchor-target" id="setup-checklist">
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

      <ConsoleSection
        description="Work through these steps in order. Each checklist heading jumps to the exact place where you finish that part of onboarding."
        title="Setup checklist"
        titleAs="h3"
      >
        <ConsoleDisclosure
          className="tenant-checklist-card"
          defaultOpen={false}
          description={
            checklistComplete
              ? "All setup steps are complete. Open the checklist whenever you want to review the sequence."
              : `${completedSteps}/${onboardingChecklist.length} setup steps are complete. Finish the checklist below before public checkout goes live.`
          }
          lockedOpen={!checklistComplete}
          title="Organizer setup"
        >
          {!checklistComplete ? (
            <p className="tenant-checklist-banner">
              Click each checklist item below to configure ZecTix.
            </p>
          ) : null}

          <ol className="tenant-checklist">
            {onboardingChecklist.map((item, index) => (
              <li
                className={`tenant-checklist-item console-anchor-target${
                  item.complete ? " tenant-checklist-item-complete" : ""
                }`}
                id={
                  item.stepId === "activate_public_checkout"
                    ? "activate-public-checkout"
                    : undefined
                }
                key={item.label}
              >
                <div className="tenant-checklist-marker" aria-hidden="true">
                  {item.complete ? "✓" : String(index + 1)}
                </div>
                <div>
                  <strong>
                    <Link
                      className="tenant-checklist-link"
                      href={checklistItemHref(item.stepId)}
                    >
                      {item.label}
                    </Link>
                  </strong>
                  <p className="subtle-text">{item.description}</p>
                  {item.stepId === "activate_public_checkout" &&
                  !item.complete ? (
                    <div className="button-row tenant-checklist-item-actions">
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
                            value={withHash(
                              setupTabPath,
                              "activate-public-checkout",
                            )}
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
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </ConsoleDisclosure>
      </ConsoleSection>
    </div>
  );
}
