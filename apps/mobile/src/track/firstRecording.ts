// Whether this is the first walk this phone records (#108): then the app explains Akku and "Immer zulassen" once
// (hints.ts). Kept with what the device keeps, so a new sign-in explains again.
import { loadKept, saveKept } from "../data/kept";

const KEY = "hintsShown";

/** True the first time it is asked (and then never again on this sign-in). */
export function takeFirstRecording(): boolean {
  if (loadKept(KEY) === true) return false;
  saveKept(KEY, true);
  return true;
}
