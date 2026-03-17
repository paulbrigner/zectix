"use client";

import { appPath } from "@/lib/app-paths";
import { cipherPayDefaultsForNetwork } from "@/lib/test-harness/utils";

export async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export function appApiPath(path: string) {
  return appPath(path);
}

export function cipherPayWebhookCallbackUrl(origin: string) {
  return `${origin.replace(/\/+$/, "")}${appApiPath("/api/cipherpay/webhook")}`;
}

export function lumaWebhookCallbackUrl(origin: string) {
  return `${origin.replace(/\/+$/, "")}${appApiPath("/api/luma/webhook")}`;
}

export { cipherPayDefaultsForNetwork };
