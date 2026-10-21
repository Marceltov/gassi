// The day at a glance from the API's `today`: refreshed when Start gains focus and whenever the walk or training
// changes (a walk's pee/poop/stop all show in the tiles). Unreachable, the last value stays; a feeding or pee/poop
// tapped without reception shows at once.
import type { Output } from "@gassi/api-client";
import { layerToday, type Tiles } from "@gassi/domain";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGassi } from "../data/GassiProvider";

/** The tiles: the server's `today` with the taps not sent yet laid over it. */
export type Today = Tiles;

export function useToday(): Today {
  const { api, view, unsent, pending, me } = useGassi();
  const [today, setToday] = useState<Output<"today"> | null>(null);
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
  return useMemo(() => layerToday(today, pending, me), [today, pending, me]);
}
