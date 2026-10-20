import { BottomNav } from "@/components/BottomNav";
import { requireUser } from "@/app/_lib/session";
import { sessions } from "@/backend";

// Every signed-in screen: its content above the bottom bar, and above that the leash bar while a walk or training runs.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const running = await (await sessions()).current();
  return (
    <>
      <div className="mx-auto max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(var(--chrome)+1rem+env(safe-area-inset-bottom))]">{children}</div>
      <BottomNav user={user} running={running} />
    </>
  );
}
