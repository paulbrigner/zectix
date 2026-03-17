import { getDashboardData } from "@/lib/test-harness/state";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getDashboardData();
    return jsonOk(data);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load test dashboard",
      500,
    );
  }
}

