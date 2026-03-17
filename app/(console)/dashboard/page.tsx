import { redirect } from "next/navigation";
import { getRuntimeConfig } from "@/lib/test-harness/state";
import { hasCoreTestSetup } from "@/lib/test-harness/utils";
import { TestOverviewClient } from "./overview-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TestOverviewPage() {
  const config = await getRuntimeConfig({ allowMissingTable: true });

  if (!hasCoreTestSetup(config)) {
    redirect("/admin");
  }

  return <TestOverviewClient />;
}
