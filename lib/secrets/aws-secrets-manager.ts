import { randomUUID } from "node:crypto";
import {
  CreateSecretCommand,
  DeleteSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type { SecretStore } from "@/lib/secrets/types";

function secretPrefix() {
  return process.env.SECRET_STORE_PREFIX?.trim() || "zectix";
}

function getSecretsClient() {
  return new SecretsManagerClient({
    region: process.env.AWS_REGION || "us-east-1",
  });
}

export class AwsSecretsManagerSecretStore implements SecretStore {
  async getSecret(ref: string) {
    const response = await getSecretsClient().send(
      new GetSecretValueCommand({
        SecretId: ref,
      }),
    );
    return response.SecretString || null;
  }

  async setSecret(ref: string | null, value: string) {
    const client = getSecretsClient();
    if (ref) {
      await client.send(
        new PutSecretValueCommand({
          SecretId: ref,
          SecretString: value,
        }),
      );
      return ref;
    }

    const created = await client.send(
      new CreateSecretCommand({
        Name: `${secretPrefix()}/${randomUUID()}`,
        SecretString: value,
      }),
    );

    return created.ARN || created.Name || `${secretPrefix()}/${randomUUID()}`;
  }

  async deleteSecret(ref: string) {
    try {
      await getSecretsClient().send(
        new DeleteSecretCommand({
          RecoveryWindowInDays: 30,
          SecretId: ref,
        }),
      );
    } catch (error) {
      const candidate = error as { name?: string } | null;
      if (candidate?.name === "ResourceNotFoundException") {
        return;
      }

      throw error;
    }
  }
}
