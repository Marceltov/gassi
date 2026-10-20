import type { Metadata } from "next";
import { requireUser } from "@/app/_lib/session";
import { config, sessions } from "@/backend";
import { WalkScreen } from "@/components/WalkScreen";

export const metadata: Metadata = { title: "Runde" };
export const dynamic = "force-dynamic";

export default async function Walk({ searchParams }: PageProps<"/runde">) {
  const user = await requireUser();
  const { fertig } = await searchParams;
  const finishedKey = typeof fertig === "string" ? fertig : null;
  const s = await sessions();
  const [view, summary] = await Promise.all([s.current(), finishedKey ? s.summaryFor(finishedKey) : null]);
  return <WalkScreen view={view} user={user} timeZone={config().timeZone} finishedKey={finishedKey} summary={summary} />;
}
