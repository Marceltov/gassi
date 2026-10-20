"use client";

import { useEffect, useState } from "react";

/** The current time in ms, starting from the server's `initial` (so the first render matches) and ticking every 30 s. */
export function useNow(initial: string): number {
  const [now, setNow] = useState(() => Date.parse(initial));
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [initial]);
  return now;
}

/** The current time in ms, ticking every `ms` (1 s for a running clock); null until mounted, so server and client agree. */
export function useTicker(ms = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
