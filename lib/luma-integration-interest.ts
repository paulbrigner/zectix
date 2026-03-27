const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_LUMA_INTEREST_SUBMIT_DELAY_MS = 3000;

export const LUMA_INTEREST_EVENT_VOLUME_OPTIONS = [
  "1-2 events per month",
  "3-5 events per month",
  "6+ events per month",
  "Still exploring",
] as const;

export const LUMA_INTEREST_TIMELINE_OPTIONS = [
  "As soon as possible",
  "This quarter",
  "Later this year",
  "Just researching",
] as const;

export type LumaInterestEventVolume = (typeof LUMA_INTEREST_EVENT_VOLUME_OPTIONS)[number];
export type LumaInterestTimeline = (typeof LUMA_INTEREST_TIMELINE_OPTIONS)[number];

export type LumaIntegrationInterestSubmission = {
  fullName: string;
  organization: string;
  email: string;
  websiteOrLumaUrl: string | null;
  eventVolume: LumaInterestEventVolume;
  timeline: LumaInterestTimeline;
  notes: string;
};

type RawSubmission = {
  companyFax?: unknown;
  email?: unknown;
  eventVolume?: unknown;
  formReadyAt?: unknown;
  fullName?: unknown;
  notes?: unknown;
  organization?: unknown;
  submittedAt?: unknown;
  timeline?: unknown;
  websiteOrLumaUrl?: unknown;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalTrimmedString(value: unknown) {
  const trimmed = asTrimmedString(value);
  return trimmed || null;
}

function isIsoDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isValidWebsiteOrLumaUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isEventVolume(value: string): value is LumaInterestEventVolume {
  return (LUMA_INTEREST_EVENT_VOLUME_OPTIONS as readonly string[]).includes(value);
}

function isTimeline(value: string): value is LumaInterestTimeline {
  return (LUMA_INTEREST_TIMELINE_OPTIONS as readonly string[]).includes(value);
}

export function parseLumaIntegrationInterestSubmission(payload: unknown):
  | { ok: true; data: LumaIntegrationInterestSubmission }
  | { ok: false; error: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const body = payload as RawSubmission;

  if (asTrimmedString(body.companyFax)) {
    return { ok: false, error: "Submission blocked." };
  }

  const formReadyAt = asTrimmedString(body.formReadyAt);
  const submittedAt = asTrimmedString(body.submittedAt);
  const formReadyTimestamp = isIsoDate(formReadyAt);
  const submittedTimestamp = isIsoDate(submittedAt);

  if (!formReadyTimestamp || !submittedTimestamp) {
    return { ok: false, error: "Invalid submission timing." };
  }

  if (submittedTimestamp < formReadyTimestamp) {
    return { ok: false, error: "Invalid submission timing." };
  }

  if (submittedTimestamp - formReadyTimestamp < MIN_LUMA_INTEREST_SUBMIT_DELAY_MS) {
    return {
      ok: false,
      error: "Please take a moment to complete the form before submitting.",
    };
  }

  const fullName = asTrimmedString(body.fullName);
  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, error: "Please enter your full name." };
  }

  const organization = asTrimmedString(body.organization);
  if (organization.length < 2 || organization.length > 160) {
    return { ok: false, error: "Please enter your organization name." };
  }

  const email = asTrimmedString(body.email).toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const websiteOrLumaUrl = asOptionalTrimmedString(body.websiteOrLumaUrl);
  if (websiteOrLumaUrl && !isValidWebsiteOrLumaUrl(websiteOrLumaUrl)) {
    return {
      ok: false,
      error: "Website or Luma calendar URL must start with http:// or https://.",
    };
  }

  const eventVolume = asTrimmedString(body.eventVolume);
  if (!isEventVolume(eventVolume)) {
    return { ok: false, error: "Please choose an expected event volume." };
  }

  const timeline = asTrimmedString(body.timeline);
  if (!isTimeline(timeline)) {
    return { ok: false, error: "Please choose a target timeline." };
  }

  const notes = asTrimmedString(body.notes);
  if (notes.length < 10 || notes.length > 2000) {
    return {
      ok: false,
      error: "Please share a bit more about your use case.",
    };
  }

  return {
    ok: true,
    data: {
      fullName,
      organization,
      email,
      websiteOrLumaUrl,
      eventVolume,
      timeline,
      notes,
    },
  };
}

export function buildLumaIntegrationInterestEmail(
  submission: LumaIntegrationInterestSubmission,
) {
  const subject = `New ZecTix Luma integration inquiry: ${submission.organization}`;
  const websiteLine = submission.websiteOrLumaUrl || "Not provided";
  const text = [
    "New ZecTix Luma integration inquiry",
    "",
    `Name: ${submission.fullName}`,
    `Organization: ${submission.organization}`,
    `Email: ${submission.email}`,
    `Website / Luma URL: ${websiteLine}`,
    `Expected event volume: ${submission.eventVolume}`,
    `Target timeline: ${submission.timeline}`,
    "",
    "Notes:",
    submission.notes,
  ].join("\n");

  const html = [
    "<h1>New ZecTix Luma integration inquiry</h1>",
    "<table cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse\">",
    `<tr><td style="padding:6px 12px 6px 0"><strong>Name</strong></td><td>${escapeHtml(submission.fullName)}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0"><strong>Organization</strong></td><td>${escapeHtml(submission.organization)}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0"><strong>Email</strong></td><td>${escapeHtml(submission.email)}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0"><strong>Website / Luma URL</strong></td><td>${escapeHtml(websiteLine)}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0"><strong>Expected event volume</strong></td><td>${escapeHtml(submission.eventVolume)}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0"><strong>Target timeline</strong></td><td>${escapeHtml(submission.timeline)}</td></tr>`,
    "</table>",
    "<h2 style=\"margin-top:24px\">Notes</h2>",
    `<p style="white-space:pre-wrap">${escapeHtml(submission.notes)}</p>`,
  ].join("");

  return { subject, text, html };
}

export function getLumaIntegrationInterestEmailConfig():
  | { fromEmail: string; toEmail: string }
  | null {
  const fromEmail = asOptionalTrimmedString(process.env.LUMA_INTEREST_FROM_EMAIL);
  const toEmail = asOptionalTrimmedString(process.env.LUMA_INTEREST_INBOX_EMAIL);

  if (!fromEmail || !toEmail) {
    return null;
  }

  return { fromEmail, toEmail };
}
