import { jsonError, jsonOk } from "@/lib/http";
import { getSession } from "@/lib/test-harness/state";
import { hydrateRegisteredSessionGuestLookup } from "@/lib/test-harness/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  if (!sessionId) {
    return jsonError("sessionId is required");
  }

  try {
    const session = await getSession(sessionId);
    if (!session) {
      return jsonError("Checkout session was not found.", 404);
    }

    const hydratedSession = await hydrateRegisteredSessionGuestLookup(session);

    return jsonOk({ session: hydratedSession });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load checkout session",
      500,
    );
  }
}
