import Link from "next/link";

// A full-screen message with one way on, for the 404 and error pages.
export function Notice({ title, text, action }: { title: string; text: string; action: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="text-lg text-muted">{text}</p>
      <div className="mt-4">{action}</div>
    </main>
  );
}

export const noticeButton = "flex min-h-14 w-full items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-ink";

export function HomeLink() {
  return (
    <Link href="/" className={noticeButton}>
      Zu Heute
    </Link>
  );
}
