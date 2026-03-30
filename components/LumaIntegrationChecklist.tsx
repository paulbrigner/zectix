"use client";

import { useState } from "react";
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
        label:
          "I understand ZecTix is non-custodial and cannot spend, move, or otherwise transact with my ZEC.",
        detail:
          "Managed checkout uses CipherPay's non-custodial, fully shielded payment flow to settle directly to your Zcash wallet.",
      },
      {
        id: "billing-fees",
        label:
          "I understand successful managed checkouts incur a ZecTix service fee.",
        detail:
          "Platform fees of 33 bps are billed monthly via a CipherPay invoice.",
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
      "Public checkout works best when the mirrored ticket tiers follow these constraints.",
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
          "Checkout questions are not supported in the managed mirrored checkout flow at this time.",
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

  const readyToContinue = allItems.every((item) => checkedItems[item.id]);

  return (
    <div className="landing-interest-card landing-readiness-card">
      <p className="landing-label">Setup checklist</p>
      <h2 className="landing-section-title landing-interest-title">
        Confirm these requirements
      </h2>
      <p className="landing-section-desc">
        Make sure the technical inputs and ticket restrictions fit your setup.
        When every item is checked, you can continue straight into organizer
        onboarding.
      </p>

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
      </div>
    </div>
  );
}
