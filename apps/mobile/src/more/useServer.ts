// What a Mehr screen reads from the server: asked when the screen comes to the front, when reception returns and on
// `reload()` (after a change). What was read stays on screen while a later ask fails; an answer to an older ask is
// dropped.
import type { Client } from "@gassi/api-client";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../data/api";
import { useGassi } from "../data/GassiProvider";

export type Read<T> = { data: T | null; error: string | null; reload: () => void };

export function useServer<T>(ask: (api: Client) => Promise<T>): Read<T> {
  const { api, online } = useGassi();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asks, setAsks] = useState(0);
  const reload = useCallback(() => setAsks((n) => n + 1), []);
  useFocusEffect(reload);

  // the latest `ask` (screens pass a new arrow each render); set before the effect below runs
  const askRef = useRef(ask);
  useEffect(() => {
    askRef.current = ask;
  });
  const asked = useRef(0);
  useEffect(() => {
    if (!api || asks === 0) return;
    const n = ++asked.current;
    askRef.current(api).then(
      (d) => {
        if (n !== asked.current) return;
        setData(d);
        setError(null);
      },
      (e) => n === asked.current && setError(errorMessage(e)),
    );
  }, [api, online, asks]);

  return { data, error, reload };
}
