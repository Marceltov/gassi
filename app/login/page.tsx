import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IconDog } from "@tabler/icons-react";
import { config, safeNext } from "@/backend";
import { currentUser } from "@/app/_lib/session";

export const metadata: Metadata = { title: "Anmelden" };

export default async function Login({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const target = safeNext(next);
  if (await currentUser()) redirect(target);
  const start = `/api/oidc/start${target === "/" ? "" : `?next=${encodeURIComponent(target)}`}`;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 pt-[max(4rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div>
        <IconDog size={56} stroke={1.5} className="text-walk" aria-hidden />
        <h1 className="mt-6 text-5xl font-extrabold tracking-tight">Gassi</h1>
        <p className="mt-3 text-lg text-muted">Wer war mit {config().dogName} draußen, wer hat gefüttert? Hier steht es.</p>
      </div>
      <div>
        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-danger/40 px-4 py-3 text-danger">
            Anmelden hat nicht geklappt. Versuch es noch einmal.
          </p>
        )}
        {/* A plain link, not a fetch: the browser has to follow the redirects to authentik and back. */}
        <a href={start} className="flex min-h-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-ink">
          Anmelden
        </a>
      </div>
    </main>
  );
}
