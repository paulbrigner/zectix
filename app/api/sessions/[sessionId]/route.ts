import { jsonError, jsonOk } from "@/lib/http";
import { getSession } from "@/lib/app-state/state";
import { syncAcceptedSessionRegistration } from "@/lib/app-state/service";
import { isSessionViewerTokenValid } from "@/lib/session-viewer";

export const runtime = "nodejs";

export async function GET(
  request: Request,
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

    const viewerToken = new URL(request.url).searchParams.get("t");
    if (
      !isSessionViewerTokenValid(
        session.session_id,
        session.attendee_email,
        viewerToken,
      )
    ) {
      return jsonError("Checkout session access is not authorized.", 403);
    }

    const hydratedSession = await syncAcceptedSessionRegistration(session);

    return jsonOk({ session: hydratedSession });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load checkout session",
      500,
    );
  }
}
