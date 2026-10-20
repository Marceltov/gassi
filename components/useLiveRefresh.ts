"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Reloads the page's server data when the app comes back to the foreground and every `intervalMs` while it is shown,
 * so a walk started or stopped on the other phone shows up here. */
export function useLiveRefresh(intervalMs = 30_000): void {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", refresh);
    const id = setInterval(refresh, intervalMs);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(id);
    };
  }, [router, intervalMs]);
}
