// The last household and sessions the server showed, so a reopened app shows them at once (also without
// reception) until the server answers. The web keeps them in localStorage (snapshot.web.ts); the Android app (step 3)
// brings its own file next to this one. Until then a native build keeps them only while it runs.
import type { SessionsView } from "@gassi/domain";
import type { GassiState } from "./store";

export type Snapshot = Pick<GassiState, "household" | "people" | "dogs" | "exercises" | "treatKinds"> & { me: NonNullable<GassiState["me"]>; view: SessionsView };

let current: Snapshot | null = null;

/** The snapshot of `personId`'s household, if one was kept. */
export const loadSnapshot = (personId: string): Snapshot | null => (current?.me.id === personId ? current : null);
export function saveSnapshot(s: Snapshot): void {
  current = s;
}
export function clearSnapshot(): void {
  current = null;
}
