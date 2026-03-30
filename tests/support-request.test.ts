import { describe, expect, it } from "vitest";
import {
  buildSupportRequestEmail,
  parseSupportRequestSubmission,
} from "@/lib/support-request";

describe("support request helper", () => {
  it("parses a valid support request", () => {
    const result = parseSupportRequestSubmission({
      email: "organizer@example.com",
      organization: "PGP for Crypto",
      subject: "Embed origin question",
      message:
        "I enabled embedding, added my allowed origin, and I still get blocked when loading the iframe.",
      contextPath: "/dashboard/pgpforcrypto/embed",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        email: "organizer@example.com",
        organization: "PGP for Crypto",
        subject: "Embed origin question",
        message:
          "I enabled embedding, added my allowed origin, and I still get blocked when loading the iframe.",
        contextPath: "/dashboard/pgpforcrypto/embed",
      },
    });
  });

  it("rejects short subjects", () => {
    const result = parseSupportRequestSubmission({
      email: "organizer@example.com",
      subject: "Hey",
      message:
        "I need help with a broken workflow that does not explain what failed.",
    });

    expect(result).toEqual({
      ok: false,
      error: "Please add a short subject for your request.",
    });
  });

  it("builds a readable support email payload", () => {
    const result = buildSupportRequestEmail({
      email: "organizer@example.com",
      organization: "ZecTix Demo Org",
      subject: "Billing question",
      message: "Can you explain why this cycle moved to invoiced?",
      contextPath: "/dashboard/demo/billing",
    });

    expect(result.subject).toContain("Billing question");
    expect(result.text).toContain("organizer@example.com");
    expect(result.html).toContain("ZecTix Demo Org");
  });
});
