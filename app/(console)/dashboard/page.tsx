import { redirect } from "next/navigation";
import { getRuntimeConfig } from "@/lib/app-state/state";
import { hasCoreSetup } from "@/lib/app-state/utils";
import { TestOverviewClient } from "./overview-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TestOverviewPage() {
  const config = await getRuntimeConfig({ allowMissingTable: true });

  if (!hasCoreSetup(config)) {
    redirect("/admin");
  }

  return <TestOverviewClient />;
}
