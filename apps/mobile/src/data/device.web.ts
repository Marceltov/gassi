// The signed-in device in localStorage, so a reload or a new tab stays signed in. Another tab signing in or out is
// heard through the storage event. "./device" means this file on the web, so device.ts is named with its extension,
// for its types and to hold this file to the same interface (see the end).
import type * as Native from "./device.ts";

export type Device = Native.Device;
export const DEVICE_KEY: typeof Native.DEVICE_KEY = "gassi.device";

const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());

let cache: { raw: string | null; device: Device | null } = { raw: null, device: null };

function read(): string | null {
  try {
    return localStorage.getItem(DEVICE_KEY);
  } catch {
    return null; // storage blocked: signed out
  }
}

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
  const raw = read();
  if (raw !== cache.raw) cache = { raw, device: parse(raw) };
  return cache.device;
}

export function saveDevice(d: Device): void {
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ token: d.token, serverUrl: d.serverUrl, person: { id: d.person.id, name: d.person.name } }));
  } catch {
    // storage blocked (private mode): nothing to keep the sign-in in
  }
  changed();
}

export function clearDevice(): void {
  try {
    localStorage.removeItem(DEVICE_KEY);
  } catch {
    // nothing stored then either
  }
  changed();
}

/** Calls `fn` whenever the device changes, in this tab or another; returns the unsubscribe. */
export function subscribeDevice(fn: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === DEVICE_KEY || e.key === null) fn();
  };
  listeners.add(fn);
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

const sameAsNative: Omit<typeof Native, "DEVICE_KEY"> = { loadDevice, saveDevice, clearDevice, subscribeDevice };
void sameAsNative;
