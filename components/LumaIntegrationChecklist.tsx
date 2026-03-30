"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

type ChecklistItem = {
  actionHref?: string;
  actionLabel?: string;
  id: string;
  label: string;
  detail: string;
};

type ChecklistSection = {
  title: string;
  description: string;
  items: ChecklistItem[];
};

const checklistSections: ChecklistSection[] = [
  {
    title: "Billing and service disclosures",
    description:
      "Make sure the commercial model is understood before you begin setup.",
    items: [
      {
        id: "billing-zec",
        label: "I understand ZecTix billing is tracked natively in ZEC.",
        detail:
          "Platform fees, cycle balances, and settlement tracking are all handled in ZEC rather than USD.",
      },
      {
        id: "billing-fees",
        label:
          "I understand successful managed checkouts incur a ZecTix service fee.",
        detail:
          "The organizer dashboard will show current billing status, cycle history, and outstanding balances.",
      },
      {
        id: "public-controls",
        label:
          "I understand public checkout can be enabled or hidden at the event and ticket level.",
        detail:
          "Meeting the ticket assertions does not force an event live. Unsupported or intentionally hidden inventory can stay private.",
      },
    ],
  },
  {
    title: "Technical requirements",
    description:
      "These are the accounts and access you will need in order to complete self-serve onboarding.",
    items: [
      {
        id: "cipherpay-account",
        label: "I have a CipherPay merchant account.",
        detail:
          "You will connect the merchant account used for Zcash settlement and managed checkout activity.",
        actionHref: "https://www.cipherpay.app/en/dashboard/login",
        actionLabel: "Open CipherPay",
      },
      {
        id: "luma-access",
        label: "I have a Luma API key.",
        detail:
          "The dashboard will ask for the Luma API credentials needed to sync eligible events and tickets.",
        actionHref:
          "https://docs.luma.com/reference/getting-started-with-your-api",
        actionLabel: "Luma API docs",
      },
    ],
  },
  {
    title: "Supported event restrictions",
    description:
      "Managed public checkout works best when the mirrored ticket tiers follow these constraints.",
    items: [
      {
        id: "fixed-price",
        label: "My supported public ticket tiers use fixed prices.",
        detail:
          "Open-ended pricing and other variable-price structures should stay outside the managed mirrored checkout flow.",
      },
      {
        id: "no-approvals",
        label:
          "My supported public ticket tiers do not require organizer approval.",
        detail:
          "Tickets that still need manual review or approval should remain hidden from public managed checkout.",
      },
      {
        id: "no-questions",
        label:
          "My supported public ticket tiers do not require extra checkout questions.",
        detail:
          "Question-heavy flows can stay off until they are handled in a way that fits the mirrored checkout model.",
      },
    ],
  },
];

const allItems = checklistSections.flatMap((section) => section.items);

export function LumaIntegrationChecklist() {
  const router = useRouter();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(allItems.map((item) => [item.id, false])) as Record<
        string,
        boolean
      >,
  );

  const completedCount = useMemo(
    () => Object.values(checkedItems).filter(Boolean).length,
    [checkedItems],
  );
  const totalCount = allItems.length;
  const readyToContinue = completedCount === totalCount;

  return (
    <div className="landing-interest-card landing-readiness-card">
      <p className="landing-label">Self-serve readiness</p>
      <h2 className="landing-section-title landing-interest-title">
        Review the checklist before you continue.
      </h2>
      <p className="landing-section-desc">
        Confirm the billing model, the technical inputs you have on hand, and
        the ticket restrictions that apply to managed mirrored checkout. When
        every item is checked, you can go straight into organizer onboarding.
      </p>
      <p className="landing-interest-help">
        ZecTix configures the managed Luma webhook for you after you connect a
        valid API key.
      </p>

      <div aria-live="polite" className="landing-readiness-progress">
        <strong>{`${completedCount}/${totalCount} confirmed`}</strong>
        <span>
          {readyToContinue
            ? "Everything is confirmed. Continue to connect your accounts."
            : "Check every item to unlock dashboard setup."}
        </span>
      </div>

      <div className="landing-readiness-sections">
        {checklistSections.map((section) => (
          <section className="landing-readiness-block" key={section.title}>
            <div className="landing-readiness-head">
              <h3 className="landing-step-title">{section.title}</h3>
              <p className="landing-interest-help">{section.description}</p>
            </div>

            <div className="landing-readiness-list">
              {section.items.map((item) => (
                <div className="landing-readiness-item" key={item.id}>
                  <input
                    checked={checkedItems[item.id] ?? false}
                    id={item.id}
                    onChange={() =>
                      setCheckedItems((current) => ({
                        ...current,
                        [item.id]: !current[item.id],
                      }))
                    }
                    type="checkbox"
                  />
                  <span>
                    <label
                      className="landing-readiness-item-label"
                      htmlFor={item.id}
                    >
                      {item.label}
                    </label>
                    <span>{item.detail}</span>
                    {item.actionHref && item.actionLabel ? (
                      <a
                        className="landing-readiness-link"
                        href={item.actionHref}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {item.actionLabel}
                      </a>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="landing-readiness-actions">
        <Button
          disabled={!readyToContinue}
          onClick={() => router.push("/dashboard/start")}
          type="button"
          variant="landing-primary"
        >
          Continue to dashboard setup
        </Button>
        <p className="landing-interest-help">
          You will connect Luma and CipherPay inside the organizer dashboard.
        </p>
      </div>
    </div>
  );
}
