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
