import { LocalDevSecretStore } from "@/lib/secrets/local";
import { AwsSecretsManagerSecretStore } from "@/lib/secrets/aws-secrets-manager";
import type { SecretStore } from "@/lib/secrets/types";

export function getSecretStoreBackend() {
  if (process.env.SECRET_STORE_BACKEND === "aws-secrets-manager") {
    return "aws-secrets-manager" as const;
  }

  if (process.env.SECRET_STORE_BACKEND === "local") {
    return "local" as const;
  }

  return process.env.NODE_ENV === "production"
    ? ("aws-secrets-manager" as const)
    : ("local" as const);
}

let cachedStore: SecretStore | null = null;

export function getSecretStore() {
  if (cachedStore) {
    return cachedStore;
  }

  cachedStore =
    getSecretStoreBackend() === "aws-secrets-manager"
      ? new AwsSecretsManagerSecretStore()
      : new LocalDevSecretStore();

  return cachedStore;
}
