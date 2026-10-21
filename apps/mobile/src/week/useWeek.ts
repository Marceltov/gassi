// The week starting `monday` from the server. The weeks seen are kept, so with no reception the last loaded one still
// shows (and says so); a week never loaded says there is no connection. Read again when the screen comes to the
// front and when reception returns; an answer for a week no longer asked for is dropped.
import type { Output } from "@gassi/api-client";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../data/api";
import { useGassi } from "../data/GassiProvider";

type Week = Output<"week">;
export type WeekState = { week: Week | null; stale: boolean; error: string | null };

export function useWeek(monday: string): WeekState {
  const { api, online } = useGassi();
  const [seen, setSeen] = useState<Record<string, Week>>({});
  const [failed, setFailed] = useState<{ monday: string; error: string } | null>(null);
  const [asks, setAsks] = useState(0);
  useFocusEffect(useCallback(() => setAsks((n) => n + 1), []));

  const asked = useRef(0);
  useEffect(() => {
    if (!api) return;
    const n = ++asked.current;
    api.week({ w: monday }).then(
      (week) => {
        if (n !== asked.current) return;
        setSeen((s) => ({ ...s, [monday]: week }));
        setFailed(null);
      },
      (e) => n === asked.current && setFailed({ monday, error: errorMessage(e) }),
    );
  }, [api, monday, online, asks]);

  const week = seen[monday] ?? null;
  const error = failed?.monday === monday ? failed.error : null;
  return { week, stale: !!week && !!error, error: week ? null : error };
}
