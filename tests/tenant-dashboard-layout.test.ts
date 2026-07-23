import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(
  new URL(
    "../app/dashboard/(protected)/[tenantSlug]/layout.tsx",
    import.meta.url,
  ),
  "utf8",
);

const childWorkspaceSources = [
  "page.tsx",
  "billing/page.tsx",
  "connections/page.tsx",
  "embed/page.tsx",
  "events/page.tsx",
  "settings/page.tsx",
].map((relativePath) => ({
  relativePath,
  source: readFileSync(
    new URL(
      `../app/dashboard/(protected)/[tenantSlug]/${relativePath}`,
      import.meta.url,
    ),
    "utf8",
  ),
}));

describe("tenant dashboard shared layout", () => {
  it("uses the lightweight tenant access lookup instead of operational detail", () => {
    expect(layoutSource).toContain("getTenantBySlug");
    expect(layoutSource).not.toContain("getTenantSelfServeDetailBySlug");
    expect(layoutSource).toContain(
      "normalizeEmailAddress(tenant.contact_email) !== normalizeEmailAddress(email)",
    );
  });

  it.each(childWorkspaceSources)(
    "leaves the full detail load to $relativePath",
    ({ source }) => {
      expect(
        source.match(/await getTenantSelfServeDetailBySlug\(/g),
      ).toHaveLength(1);
    },
  );
});
