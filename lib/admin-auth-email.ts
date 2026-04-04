import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { appUrl } from "@/lib/app-paths";
import {
  getAdminAuthFromEmail,
  getAdminLoginEmail,
} from "@/lib/admin-auth";
import { isProductionRuntime } from "@/lib/runtime-env";

let cachedSesClient: SESv2Client | null = null;

function getSesClient() {
  if (!cachedSesClient) {
    cachedSesClient = new SESv2Client({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }

  return cachedSesClient;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getAdminAuthEmailConfig() {
  const loginEmail = getAdminLoginEmail();
  const fromEmail = getAdminAuthFromEmail();

  if (!loginEmail || !fromEmail) {
    return null;
  }

  return {
    loginEmail,
    fromEmail,
  };
}

export function buildAdminMagicLinkEmail(verifyUrl: string) {
  const subject = "Your ZecTix operator sign-in link";
  const text = [
    "Use the one-time link below to sign in to the ZecTix operator console.",
    "",
    verifyUrl,
    "",
    "This link expires in 15 minutes.",
    "It can only be used once.",
    "If you did not request it, you can ignore this email.",
  ].join("\n");

  const html = [
    "<h1>ZecTix operator sign-in</h1>",
    "<p>Use the one-time link below to sign in to the ZecTix operator console.</p>",
    `<p><a href="${escapeHtml(verifyUrl)}">Sign in to ZecTix</a></p>`,
    `<p style="word-break:break-all">${escapeHtml(verifyUrl)}</p>`,
    "<p>This link expires in 15 minutes.</p>",
    "<p>It can only be used once.</p>",
    "<p>If you did not request it, you can ignore this email.</p>",
  ].join("");

  return { subject, text, html };
}

export function buildAdminMagicLinkUrl(token: string) {
  return appUrl(`/ops/login/verify?token=${encodeURIComponent(token)}`);
}

export async function sendAdminMagicLinkEmail(email: string, token: string) {
  const config = getAdminAuthEmailConfig();
  if (!config) {
    throw new Error("Admin email auth is not configured.");
  }

  if (email !== config.loginEmail) {
    throw new Error("Requested admin email is not allowed.");
  }

  const verifyUrl = buildAdminMagicLinkUrl(token);
  if (!verifyUrl) {
    throw new Error("APP_PUBLIC_ORIGIN must be configured for admin email sign-in.");
  }

  if (!isProductionRuntime()) {
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║  [DEV] Operator magic-link — click to sign in:         ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log(`→ ${verifyUrl}\n`);
    return;
  }

  const { subject, text, html } = buildAdminMagicLinkEmail(verifyUrl);

  await getSesClient().send(
    new SendEmailCommand({
      FromEmailAddress: config.fromEmail,
      Destination: {
        ToAddresses: [config.loginEmail],
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject,
          },
          Body: {
            Text: {
              Data: text,
            },
            Html: {
              Data: html,
            },
          },
        },
      },
    }),
  );
}
