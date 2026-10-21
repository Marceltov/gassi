import type { Metadata } from "next";
import { linkLanding } from "@/backend";

export const metadata: Metadata = { title: "Link öffnen", robots: { index: false } };
export const dynamic = "force-dynamic";

// What a setup, invite or magic link opens on the household's server: "In App öffnen" and a QR code for the app, the
// link's code for the web app on the home screen (it doesn't share Safari's storage), and sign-in right here. /join is
// the web app's page, not this Next app's, so it is a plain link.
export default async function LinkPage({ params }: PageProps<"/l/[token]">) {
  const page = await linkLanding((await params).token);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">{page.title}</h1>
      <p className="text-lg text-muted">{page.hint}</p>
      {page.valid && (
        <>
          <a href={page.appLink} className="flex min-h-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-ink">
            In App öffnen
          </a>
          <figure className="flex flex-col items-center gap-2 rounded-3xl bg-surface p-6 text-ink">
            {/* dark on white in both themes: inverted codes are read by fewer scanners */}
            <div className="w-60 rounded-xl bg-white p-2 text-black" role="img" aria-label="QR-Code für die Gassi-App" dangerouslySetInnerHTML={{ __html: page.qr }} />
            <figcaption className="text-muted">Oder in der Gassi-App scannen</figcaption>
          </figure>
          <section className="flex flex-col items-center gap-2 rounded-3xl bg-surface p-6 text-center">
            <p className="text-muted">In der Gassi-App vom Home-Bildschirm diesen Code eingeben</p>
            <p className="font-mono text-3xl font-bold tracking-widest" aria-label="Code">
              {page.code}
            </p>
          </section>
          <a href={page.webLink} className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-primary text-lg font-bold">
            Hier im Browser anmelden
          </a>
        </>
      )}
    </main>
  );
}
