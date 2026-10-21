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
  const load = useCallback(async () => {
    if (!api) return;
    try {
      setToday(await api.today());
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
  useEffect(() => {
    if (focused.current) void load();
  }, [changed, load]);
  return today;
}
