"use client";

import type { WalkView } from "@/backend";
import { useTicker } from "./useNow";
import { walkersAre } from "./useSessions";

/** "Hirsch ist seit 23 Min." / "Hirsch + Herzii sind seit 5 Min.", counting on while shown. */
export function WalksSince({ walk }: { walk: Pick<WalkView, "walkers" | "startedAt"> }) {
  const now = useTicker(30_000);
  const min = now === null ? 0 : Math.max(0, Math.floor((now - Date.parse(walk.startedAt)) / 60_000));
  return (
    <>
      {walkersAre(walk.walkers)} seit {min} Min.
    </>
  );
}
