import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SupportRequestSubmission = {
  category: string | null;
  email: string;
  organization: string | null;
  subject: string;
  message: string;
  contextPath: string | null;
};

type RawSupportRequestSubmission = {
  category?: unknown;
  email?: unknown;
  organization?: unknown;
  subject?: unknown;
  message?: unknown;
  contextPath?: unknown;
};

let cachedSesClient: SESv2Client | null = null;

function getSesClient() {
  if (!cachedSesClient) {
    cachedSesClient = new SESv2Client({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }

  return cachedSesClient;
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalTrimmedString(value: unknown) {
  const trimmed = asTrimmedString(value);
  return trimmed || null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function parseSupportRequestSubmission(payload: unknown):
  | { ok: true; data: SupportRequestSubmission }
  | { ok: false; error: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid support request." };
  }

  const body = payload as RawSupportRequestSubmission;
  const email = asTrimmedString(body.email).toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    return { ok: false, error: "Signed-in email address is invalid." };
  }

  const subject = asTrimmedString(body.subject);
  if (subject.length < 4 || subject.length > 160) {
    return { ok: false, error: "Please add a short subject for your request." };
  }

  const message = asTrimmedString(body.message);
  if (message.length < 20 || message.length > 4000) {
    return {
      ok: false,
      error: "Please include a bit more detail so we can help.",
    };
  }

  const category = asOptionalTrimmedString(body.category);
  const organization = asOptionalTrimmedString(body.organization);
  const contextPath = asOptionalTrimmedString(body.contextPath);

  return {
    ok: true,
    data: {
      category,
      email,
      organization,
      subject,
      message,
      contextPath,
    },
  };
}

export function buildSupportRequestEmail(submission: SupportRequestSubmission) {
  const categoryPrefix = submission.category
    ? `[${submission.category}] `
    : "";
  const subject = `Organizer support request: ${categoryPrefix}${submission.subject}`;
  const organization = submission.organization || "Not provided";
  const category = submission.category || "Not specified";
  const currentPage = submission.contextPath || "Not provided";
  const text = [
    "New organizer support request",
    "",
    `From: ${submission.email}`,
    `Organization: ${organization}`,
    `Topic: ${category}`,
    `Current page: ${currentPage}`,
    `Subject: ${submission.subject}`,
    "",
    submission.message,
  ].join("\n");

  const html = [
    "<h1>New organizer support request</h1>",
    "<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\">",
    `<tr><td style="padding:6px 12px 6px 0"><strong>From</strong></td><td>${escapeHtml(submission.email)}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0"><strong>Organization</strong></td><td>${escapeHtml(organization)}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0"><strong>Topic</strong></td><td>${escapeHtml(category)}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0"><strong>Current page</strong></td><td>${escapeHtml(currentPage)}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0"><strong>Subject</strong></td><td>${escapeHtml(submission.subject)}</td></tr>`,
    "</table>",
    "<h2 style=\"margin-top:24px\">Message</h2>",
    `<p style="white-space:pre-wrap">${escapeHtml(submission.message)}</p>`,
  ].join("");

  return { subject, text, html };
}

export function getSupportEmailConfig():
  | { fromEmail: string; toEmail: string }
  | null {
  const fromEmail =
    asOptionalTrimmedString(process.env.SUPPORT_FROM_EMAIL) ||
    asOptionalTrimmedString(process.env.ADMIN_AUTH_FROM_EMAIL) ||
    asOptionalTrimmedString(process.env.TENANT_AUTH_FROM_EMAIL);
  const toEmail = asOptionalTrimmedString(process.env.SUPPORT_INBOX_EMAIL);

  if (!fromEmail || !toEmail) {
    return null;
  }

  return { fromEmail, toEmail };
}

export async function sendSupportRequestEmail(
  submission: SupportRequestSubmission,
) {
  const emailConfig = getSupportEmailConfig();
  if (!emailConfig) {
    throw new Error("Support email is not configured.");
  }

  const { subject, text, html } = buildSupportRequestEmail(submission);

  await getSesClient().send(
    new SendEmailCommand({
      FromEmailAddress: emailConfig.fromEmail,
      Destination: {
        ToAddresses: [emailConfig.toEmail],
      },
      ReplyToAddresses: [submission.email],
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
