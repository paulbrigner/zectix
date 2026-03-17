import type { CipherPaySessionStatus, TestConfigRecord } from "@/lib/test-harness/types";
import { asFiniteNumber, asIsoTimestamp, asRecord, asString } from "@/lib/test-harness/utils";

export type CipherPayInvoice = {
  invoice_id: string;
  memo_code: string | null;
  amount: number | null;
  currency: string | null;
  product_name: string | null;
  size: string | null;
  price_zec: number | null;
  payment_address: string | null;
  zcash_uri: string | null;
  status: CipherPaySessionStatus;
  detected_txid: string | null;
  detected_at: string | null;
  confirmed_at: string | null;
  refunded_at: string | null;
  expires_at: string | null;
};

type CreateCipherPayInvoiceInput = {
  amount: number;
  currency: string;
  product_name: string;
  size?: string | null;
};

async function readJsonOrThrow(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `CipherPay request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

function normalizeCipherPayInvoice(value: unknown): CipherPayInvoice {
  const item = asRecord(value);
  const invoiceId = asString(item?.invoice_id) || asString(item?.id);
  if (!invoiceId) {
    throw new Error("CipherPay did not return an invoice_id");
  }

  const status = asString(item?.status);

  return {
    invoice_id: invoiceId,
    memo_code: asString(item?.memo_code),
    amount: asFiniteNumber(item?.amount),
    currency: asString(item?.currency),
    product_name: asString(item?.product_name),
    size: asString(item?.size),
    price_zec: asFiniteNumber(item?.price_zec),
    payment_address: asString(item?.payment_address),
    zcash_uri: asString(item?.zcash_uri),
    status:
      status === "draft" ||
      status === "pending" ||
      status === "underpaid" ||
      status === "detected" ||
      status === "confirmed" ||
      status === "expired" ||
      status === "refunded"
        ? status
        : "unknown",
    detected_txid: asString(item?.detected_txid) || asString(item?.txid),
    detected_at: asIsoTimestamp(item?.detected_at),
    confirmed_at: asIsoTimestamp(item?.confirmed_at),
    refunded_at: asIsoTimestamp(item?.refunded_at),
    expires_at: asIsoTimestamp(item?.expires_at),
  };
}

export function buildCipherPayCheckoutUrl(config: TestConfigRecord, invoiceId: string) {
  return `${config.checkout_base_url.replace(/\/+$/, "")}/pay/${encodeURIComponent(invoiceId)}`;
}

export async function createCipherPayInvoice(
  config: TestConfigRecord,
  input: CreateCipherPayInvoiceInput,
) {
  if (!config.api_key) {
    throw new Error("CipherPay API key is not configured");
  }

  const response = await fetch(`${config.api_base_url}/api/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.api_key}`,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  const payload = await readJsonOrThrow(response);
  const invoice = normalizeCipherPayInvoice(payload);

  return {
    invoice,
    checkout_url: buildCipherPayCheckoutUrl(config, invoice.invoice_id),
  };
}

export async function getCipherPayInvoice(
  config: TestConfigRecord,
  invoiceId: string,
) {
  if (!config.api_key) {
    throw new Error("CipherPay API key is not configured");
  }

  const response = await fetch(
    `${config.api_base_url}/api/invoices/${encodeURIComponent(invoiceId)}`,
    {
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const payload = await readJsonOrThrow(response);
  return normalizeCipherPayInvoice(payload);
}
