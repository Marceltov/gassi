"use client";

import { useRouter } from "next/navigation";
import { IconChevronLeft } from "@tabler/icons-react";

/** "‹ Zurück": to where you came from, or to `fallback` when the app was opened right on this page. */
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))} className="-ml-2 flex min-h-12 items-center gap-1 pr-3 text-lg font-semibold text-primary">
      <IconChevronLeft size={24} aria-hidden /> Zurück
    </button>
  );
}
