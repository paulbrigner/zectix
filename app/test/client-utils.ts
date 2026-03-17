"use client";

import {
  cipherPayDefaultsForNetwork,
} from "@/lib/test-harness/utils";

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

export function testWebhookCallbackUrl(origin: string) {
  return `${origin.replace(/\/+$/, "")}/api/test/webhook`;
}

export function lumaWebhookCallbackUrl(origin: string) {
  return `${origin.replace(/\/+$/, "")}/api/luma/webhook`;
}
export { cipherPayDefaultsForNetwork };
