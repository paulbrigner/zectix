import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { asRecord, asString } from "@/lib/app-state/utils";
import type { SecretRecord, SecretStore } from "@/lib/secrets/types";

function localSecretStoreFile() {
  return (
    process.env.LOCAL_SECRET_STORE_FILE ||
    path.join(process.cwd(), ".zectix-local", "secrets.json")
  );
}

async function readSecretMap() {
  try {
    const contents = await readFile(localSecretStoreFile(), "utf8");
    const parsed = JSON.parse(contents) as unknown;
    const record = asRecord(parsed);
    if (!record) {
      return {} as Record<string, SecretRecord>;
    }

    return Object.fromEntries(
      Object.entries(record)
        .map(([key, value]) => {
          const item = asRecord(value);
          const ref = asString(item?.ref);
          const secretValue = asString(item?.value);
          if (!ref || !secretValue) {
            return null;
          }

          return [key, { ref, value: secretValue } satisfies SecretRecord];
        })
        .filter(Boolean) as Array<[string, SecretRecord]>,
    );
  } catch (error) {
    const candidate = error as { code?: string } | null;
    if (candidate?.code === "ENOENT") {
      return {} as Record<string, SecretRecord>;
    }

    throw error;
  }
}

async function writeSecretMap(records: Record<string, SecretRecord>) {
  const file = localSecretStoreFile();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(records, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}

export class LocalDevSecretStore implements SecretStore {
  async getSecret(ref: string) {
    const records = await readSecretMap();
    return records[ref]?.value || null;
  }

  async setSecret(ref: string | null, value: string) {
    const records = await readSecretMap();
    const nextRef = ref || `local-secret/${randomUUID()}`;
    records[nextRef] = {
      ref: nextRef,
      value,
    };
    await writeSecretMap(records);
    return nextRef;
  }
}
