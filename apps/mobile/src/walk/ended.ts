// The walk this phone ended last, for its summary until the server knows it; kept with the rest (data/kept.ts), so a
// reload without reception still shows it.
import { dropKept, loadKept, saveKept } from "../data/kept";
import type { Ended } from "./taps";

const KEY = "endedWalk";

export function loadEnded(key: string): Ended | null {
  const e = loadKept(KEY) as Ended | null;
  return e?.key === key && Array.isArray(e.taps) && Array.isArray(e.walkers) && Array.isArray(e.pauses) ? e : null;
}

export const saveEnded = (e: Ended): void => saveKept(KEY, e);
export const clearEnded = (): void => dropKept(KEY);
