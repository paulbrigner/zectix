import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import {
  buildLumaIntegrationInterestEmail,
  getLumaIntegrationInterestEmailConfig,
  parseLumaIntegrationInterestSubmission,
} from "@/lib/luma-integration-interest";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

let cachedSesClient: SESv2Client | null = null;

function getSesClient() {
  if (!cachedSesClient) {
    cachedSesClient = new SESv2Client({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }

  return cachedSesClient;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const parsed = parseLumaIntegrationInterestSubmission(payload);
  if (!parsed.ok) {
    return jsonError(parsed.error);
  }

  const emailConfig = getLumaIntegrationInterestEmailConfig();
  if (!emailConfig) {
    return jsonError("Inquiry email is not configured.", 503);
  }

  const { subject, text, html } = buildLumaIntegrationInterestEmail(parsed.data);

  try {
    await getSesClient().send(
      new SendEmailCommand({
        FromEmailAddress: emailConfig.fromEmail,
        Destination: {
          ToAddresses: [emailConfig.toEmail],
        },
        ReplyToAddresses: [parsed.data.email],
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
  } catch (error) {
    console.error("Failed to send Luma integration inquiry email.", error);
    return jsonError("Unable to send your inquiry right now.", 502);
  }

  return jsonOk({ ok: true });
}
