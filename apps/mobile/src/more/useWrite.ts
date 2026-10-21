// A write from a Mehr screen: needs the server (no queue), so without reception it says so (OFFLINE). A second tap
// while one is on its way does nothing.
import { useCallback, useRef, useState } from "react";
import { errorMessage } from "../data/api";

export function useWrite() {
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);
  /** Runs `call`; shows `done` after it worked, else what went wrong. True when it worked. */
  const run = useCallback(async (call: () => Promise<unknown>, done: string | null = null): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    try {
      await call();
      setMessage(done);
      return true;
    } catch (e) {
      setMessage(errorMessage(e));
      return false;
    } finally {
      busy.current = false;
    }
  }, []);
  return { message, setMessage, run };
}
