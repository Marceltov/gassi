import type { Metadata } from "next";
import { requireUser } from "@/app/_lib/session";
import { catalog, config, sessions } from "@/backend";
import { TrainingScreen } from "@/components/TrainingScreen";

export const metadata: Metadata = { title: "Training" };
export const dynamic = "force-dynamic";

export default async function Training() {
  const user = await requireUser();
  const [s, c] = await Promise.all([sessions(), catalog()]);
  const [view, exercises, treatKinds] = await Promise.all([s.current(), c.exercises(), c.treatKinds()]);
  return <TrainingScreen view={view} user={user} timeZone={config().timeZone} exercises={exercises} treatKinds={treatKinds} />;
}
