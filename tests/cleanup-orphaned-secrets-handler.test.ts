import { describe, expect, it } from "vitest";
import type { SecretListEntry } from "@aws-sdk/client-secrets-manager";
import {
  collectSecretRefs,
  findOrphanedSecrets,
  normalizeCleanupOptions,
} from "../ops/aws/cleanup-orphaned-secrets-handler.mjs";

describe("cleanup orphaned secrets handler helpers", () => {
  it("collects only stored secret reference fields from app-state items", () => {
    const refs = collectSecretRefs([
      {
        luma_api_secret_ref: "arn:aws:secretsmanager:us-east-1:123:secret:zectix/api",
        luma_webhook_secret_ref: "",
        unrelated_secret_ref: "ignored",
      },
      {
        cipherpay_api_secret_ref: "zectix-staging/cipherpay-api",
        cipherpay_webhook_secret_ref: "  zectix-staging/cipherpay-webhook  ",
      },
    ]);

    expect([...refs].sort()).toEqual([
      "arn:aws:secretsmanager:us-east-1:123:secret:zectix/api",
      "zectix-staging/cipherpay-api",
      "zectix-staging/cipherpay-webhook",
    ]);
  });

  it("keeps referenced managed secrets and ignores unmanaged prefixes", () => {
    const orphaned = findOrphanedSecrets(
      [
        {
          ARN: "arn:aws:secretsmanager:us-east-1:123:secret:zectix/referenced",
          CreatedDate: new Date("2026-03-30T00:00:00.000Z"),
          Name: "zectix/referenced",
        },
        {
          ARN: "arn:aws:secretsmanager:us-east-1:123:secret:zectix/orphaned",
          CreatedDate: new Date("2026-03-31T00:00:00.000Z"),
          Name: "zectix/orphaned",
        },
        {
          ARN: "arn:aws:secretsmanager:us-east-1:123:secret:other/orphaned",
          CreatedDate: new Date("2026-03-29T00:00:00.000Z"),
          Name: "other/orphaned",
        },
      ],
      new Set(["arn:aws:secretsmanager:us-east-1:123:secret:zectix/referenced"]),
      ["zectix"],
    );

    expect(orphaned.map((secret: SecretListEntry) => secret.Name)).toEqual([
      "zectix/orphaned",
    ]);
  });

  it("normalizes cleanup options with bounded recovery windows", () => {
    const options = normalizeCleanupOptions({
      apply: "true",
      recoveryWindowInDays: "90",
      region: "us-west-2",
      secretPrefixes: "zectix, zectix-staging",
      tableNames: ["zectix", "zectix-staging"],
    });

    expect(options.apply).toBe(true);
    expect(options.recoveryWindowInDays).toBe(30);
    expect(options.region).toBe("us-west-2");
    expect(options.secretPrefixes).toEqual(["zectix", "zectix-staging"]);
    expect(options.tableNames).toEqual(["zectix", "zectix-staging"]);
  });
});
