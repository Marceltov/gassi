// The day at a glance from the API's `today`: refreshed when Start gains focus and whenever the walk or training
// changes (a walk's pee/poop/stop all show in the tiles). Unreachable, the last value stays.
import type { Output } from "@gassi/api-client";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGassi } from "../data/GassiProvider";

export type Today = Output<"today">;

export function useToday(): Today | null {
  const { api, view, unsent } = useGassi();
  const [today, setToday] = useState<Today | null>(null);
  const focused = useRef(false);
  const latest = useRef(0);
  const load = useCallback(async () => {
    if (!api) return;
    const mine = ++latest.current;
    try {
      const fresh = await api.today();
      if (mine === latest.current) setToday(fresh); // an older, slower answer never replaces a newer one
    } catch {
      // keep what we have
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void load();
      return () => {
        focused.current = false;
      };
    }, [load]),
  );
  const changed = `${view.walk?.key}:${view.walk?.pauses.length}:${view.training?.key}:${unsent}`;
  const seen = useRef(changed);
  useEffect(() => {
    if (seen.current === changed) return; // the focus effect makes the first load
    seen.current = changed;
    if (focused.current) void load();
  }, [changed, load]);
  return today;
}
