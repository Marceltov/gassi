import { diary } from "@/backend";
import { TodayScreen } from "@/components/TodayScreen";

export const dynamic = "force-dynamic";

export default async function Today() {
  const view = await (await diary()).today();
  return <TodayScreen view={view} />;
}
