import { BottomNav } from "@/components/BottomNav";
import { requireUser } from "@/app/_lib/session";

// Every signed-in screen: its content above the bottom bar.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <>
      <div className="mx-auto max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))]">{children}</div>
      <BottomNav userName={user.name} />
    </>
  );
}
