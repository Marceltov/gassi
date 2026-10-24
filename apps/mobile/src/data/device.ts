// The signed-in device: its token, the server it talks to, and who signed in (so the app knows whose taps it queues
// before the server answers, e.g. reopened without reception). Kept in storage.ts, so a restart or a new tab stays
// signed in; another tab signing in or out is heard through onStoredElsewhere.
import type { Person } from "@gassi/domain";
import { onStoredElsewhere, storage } from "./storage";

export type Device = { token: string; serverUrl: string; person: Person };

export const DEVICE_KEY = "gassi.device";

const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());

let cache: { raw: string | null; device: Device | null } = { raw: null, device: null };

function parse(raw: string | null): Device | null {
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as Partial<Device> | null;
    const p = v?.person;
    if (typeof v?.token !== "string" || !v.token || typeof v.serverUrl !== "string" || typeof p?.id !== "string" || typeof p.name !== "string") return null;
    return { token: v.token, serverUrl: v.serverUrl, person: { id: p.id, name: p.name } };
  } catch {
    return null;
  }
}

/** The device, or null when signed out; the same object until storage changes (for useSyncExternalStore). */
export function loadDevice(): Device | null {
  const raw = storage.getItem(DEVICE_KEY);
  if (raw !== cache.raw) cache = { raw, device: parse(raw) };
  return cache.device;
}

export function saveDevice(d: Device): void {
  storage.setItem(DEVICE_KEY, JSON.stringify({ token: d.token, serverUrl: d.serverUrl, person: { id: d.person.id, name: d.person.name } }));
  changed();
}

export function clearDevice(): void {
  storage.removeItem(DEVICE_KEY);
  changed();
}

/** Calls `fn` whenever the device changes, here or in another tab; returns the unsubscribe. */
export function subscribeDevice(fn: () => void): () => void {
  listeners.add(fn);
  const stopWatching = onStoredElsewhere(DEVICE_KEY, fn);
  return () => {
    listeners.delete(fn);
    stopWatching();
  };
}
