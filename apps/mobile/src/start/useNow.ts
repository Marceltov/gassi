// The current time, ticking every `everyMs` while `active`; the clocks and "vor 3 Std." texts re-render from it.
import { useEffect, useState } from "react";

export function useNow(everyMs: number, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs, active]);
  return now;
}
