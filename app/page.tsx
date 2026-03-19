import { redirect } from "next/navigation";
import { HomePage } from "@/components/HomePage";
import { getRuntimeConfig } from "@/lib/app-state/state";
import { hasCoreSetup } from "@/lib/app-state/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home() {
  const config = await getRuntimeConfig({ allowMissingTable: true });

  if (!hasCoreSetup(config)) {
    redirect("/admin");
  }

  return <HomePage />;
}
