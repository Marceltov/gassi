// The walk this phone ended last, for its summary until the server knows it. The web keeps it in localStorage
// (ended.web.ts), so a reload without reception still shows it; a native build keeps it while it runs (step 3).
import type { Ended } from "./taps";

let current: Ended | null = null;

export const loadEnded = (key: string): Ended | null => (current?.key === key ? current : null);
export function saveEnded(e: Ended): void {
  current = e;
}
export function clearEnded(): void {
  current = null;
}
