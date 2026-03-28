import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { appUrl } from "@/lib/app-paths";
import { getTenantAuthFromEmail } from "@/lib/tenant-auth";

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

export function buildTenantMagicLinkEmail(verifyUrl: string) {
  const subject = "Your ZecTix dashboard sign-in link";
  const text = [
    "Use the one-time link below to sign in to your ZecTix organizer dashboard.",
    "",
    verifyUrl,
    "",
    "This link expires in 15 minutes.",
    "It can only be used once.",
    "If you did not request it, you can ignore this email.",
  ].join("\n");

  const html = [
    "<h1>ZecTix organizer sign-in</h1>",
    "<p>Use the one-time link below to sign in to your ZecTix organizer dashboard.</p>",
    `<p><a href="${escapeHtml(verifyUrl)}">Sign in to ZecTix</a></p>`,
    `<p style="word-break:break-all">${escapeHtml(verifyUrl)}</p>`,
    "<p>This link expires in 15 minutes.</p>",
    "<p>It can only be used once.</p>",
    "<p>If you did not request it, you can ignore this email.</p>",
  ].join("");

  return { subject, text, html };
}

export function buildTenantMagicLinkUrl(token: string) {
  return appUrl(`/dashboard/login/verify?token=${encodeURIComponent(token)}`);
}

export async function sendTenantMagicLinkEmail(email: string, token: string) {
  const fromEmail = getTenantAuthFromEmail();
  if (!fromEmail) {
    throw new Error("Tenant email auth is not configured.");
  }

  const verifyUrl = buildTenantMagicLinkUrl(token);
  if (!verifyUrl) {
    throw new Error("APP_PUBLIC_ORIGIN must be configured for tenant email sign-in.");
  }

  const { subject, text, html } = buildTenantMagicLinkEmail(verifyUrl);

  await getSesClient().send(
    new SendEmailCommand({
      FromEmailAddress: fromEmail,
      Destination: {
        ToAddresses: [email],
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
