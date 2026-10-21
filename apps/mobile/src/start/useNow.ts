// The current time, ticking every `everyMs`; the clocks and "vor 3 Std." texts re-render from it. Changing the
// interval takes the time anew at once, so a clock that was ticking slowly never keeps an age from before.
import { useEffect, useState } from "react";

export function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [everyMs]);
  return now;
}
