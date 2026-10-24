// The last household and sessions the server showed, so a reopened app shows them at once (also without
// reception) until the server answers. One, of the person signed in, kept with the rest (kept.ts).
import type { SessionsView } from "@gassi/domain";
import { dropKept, loadKept, saveKept } from "./kept";
import type { GassiState } from "./store";

export type Snapshot = Pick<GassiState, "household" | "device" | "people" | "dogs" | "exercises" | "treatKinds"> & { me: NonNullable<GassiState["me"]>; view: SessionsView };

const KEY = "snapshot";

/** The snapshot of `personId`'s household, if one was kept. */
export function loadSnapshot(personId: string): Snapshot | null {
  const s = loadKept(KEY) as Snapshot | null;
  // only the fields the store reads, each of the right shape; anything else counts as none
  const ok = s?.me?.id === personId && Array.isArray(s.people) && Array.isArray(s.dogs) && Array.isArray(s.exercises) && Array.isArray(s.treatKinds) && typeof s.view === "object" && s.view !== null;
  return ok ? s : null;
}

export const saveSnapshot = (s: Snapshot): void => saveKept(KEY, s);
export const clearSnapshot = (): void => dropKept(KEY);
