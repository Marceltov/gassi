// A write from a Mehr screen: needs the server (no queue), so without reception it says so (OFFLINE), and without an
// answer within WRITE_TIMEOUT_MS that it may have been saved (NO_ANSWER). A second tap while one is on its way does
// nothing. A write that worked says nothing: the screen shows what changed, and a message would push the buttons.
import type { Client } from "@gassi/api-client";
import { useCallback, useRef, useState } from "react";
import { errorMessage } from "../data/api";
import { useGassi } from "../data/GassiProvider";

export function useWrite() {
  const { writeApi } = useGassi();
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);
  /** Runs `call` with the writes' client; shows what went wrong, if anything. True when it worked. */
  const run = useCallback(
    async (call: (api: Client) => Promise<unknown>): Promise<boolean> => {
      if (busy.current || !writeApi) return false;
      busy.current = true;
      try {
        await call(writeApi);
        setMessage(null);
        return true;
      } catch (e) {
        setMessage(errorMessage(e));
        return false;
      } finally {
        busy.current = false;
      }
    },
    [writeApi],
  );
  return { message, setMessage, run };
}
