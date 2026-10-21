// The signed-in device: its token, the server it talks to, and who signed in (so the app knows whose taps it queues
// before the server answers, e.g. reopened without reception). The web keeps it in localStorage (device.web.ts); the
// Android app (step 3) brings its own file next to this one. Until then a native build keeps it only while it runs.
import type { Person } from "@gassi/domain";

export type Device = { token: string; serverUrl: string; person: Person };

/** Where the web keeps the device. */
export const DEVICE_KEY = "gassi.device";

let current: Device | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());

/** The device, or null when signed out; the same object until it changes. */
export const loadDevice = (): Device | null => current;
export function saveDevice(d: Device): void {
  current = { token: d.token, serverUrl: d.serverUrl, person: { id: d.person.id, name: d.person.name } };
  changed();
}
export function clearDevice(): void {
  current = null;
  changed();
}
/** Calls `fn` whenever the device changes; returns the unsubscribe. */
export function subscribeDevice(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
