import { describe, expect, it } from "vitest";
import {
  buildLumaIntegrationInterestEmail,
  parseLumaIntegrationInterestSubmission,
} from "@/lib/luma-integration-interest";

describe("luma integration interest helper", () => {
  it("parses a valid submission payload", () => {
    const result = parseLumaIntegrationInterestSubmission({
      fullName: "Paul Brigner",
      organization: "ZecTix",
      email: "paul@example.com",
      websiteOrLumaUrl: "https://luma.com/zectix",
      eventVolume: "1-2 events per month",
      timeline: "As soon as possible",
      notes: "We want to add Zcash checkout to a few supported Luma events.",
      companyFax: "",
      formReadyAt: "2026-03-26T23:00:00.000Z",
      submittedAt: "2026-03-26T23:00:05.500Z",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        fullName: "Paul Brigner",
        organization: "ZecTix",
        email: "paul@example.com",
        websiteOrLumaUrl: "https://luma.com/zectix",
        eventVolume: "1-2 events per month",
        timeline: "As soon as possible",
        notes: "We want to add Zcash checkout to a few supported Luma events.",
      },
    });
  });

  it("rejects submissions that arrive too quickly", () => {
    const result = parseLumaIntegrationInterestSubmission({
      fullName: "Paul Brigner",
      organization: "ZecTix",
      email: "paul@example.com",
      eventVolume: "1-2 events per month",
      timeline: "As soon as possible",
      notes: "We want to add Zcash checkout to a few supported Luma events.",
      companyFax: "",
      formReadyAt: "2026-03-26T23:00:00.000Z",
      submittedAt: "2026-03-26T23:00:01.000Z",
    });

    expect(result).toEqual({
      ok: false,
      error: "Please take a moment to complete the form before submitting.",
    });
  });

  it("rejects non-empty honeypot submissions", () => {
    const result = parseLumaIntegrationInterestSubmission({
      fullName: "Paul Brigner",
      organization: "ZecTix",
      email: "paul@example.com",
      eventVolume: "1-2 events per month",
      timeline: "As soon as possible",
      notes: "We want to add Zcash checkout to a few supported Luma events.",
      companyFax: "https://spam.example",
      formReadyAt: "2026-03-26T23:00:00.000Z",
      submittedAt: "2026-03-26T23:00:05.000Z",
    });

    expect(result).toEqual({
      ok: false,
      error: "Submission blocked.",
    });
  });

  it("builds a readable email payload", () => {
    const result = buildLumaIntegrationInterestEmail({
      fullName: "Paul Brigner",
      organization: "ZecTix",
      email: "paul@example.com",
      websiteOrLumaUrl: "https://zectix.com",
      eventVolume: "Still exploring",
      timeline: "Just researching",
      notes: "Interested in the beta flow.",
    });

    expect(result.subject).toContain("ZecTix");
    expect(result.text).toContain("Paul Brigner");
    expect(result.html).toContain("Interested in the beta flow.");
  });
});
