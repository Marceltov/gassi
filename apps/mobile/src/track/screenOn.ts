// "Bildschirm auf der Runde anlassen" (#104): this device's choice, kept with what the device keeps (kept.ts), off
// until switched on. Mehr switches it; the recording (Recording.tsx) holds the screen while it is on.
import { useSyncExternalStore } from "react";
import { loadKept, saveKept } from "../data/kept";

const KEY = "screenOn";
const listeners = new Set<() => void>();
const load = () => loadKept(KEY) === true;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export function setScreenOn(on: boolean): void {
  saveKept(KEY, on);
  listeners.forEach((fn) => fn());
}

export const useScreenOn = (): boolean => useSyncExternalStore(subscribe, load, load);
