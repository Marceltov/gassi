// The phone's position for recording a walk's route (recorder.ts). On Android a foreground service records, also with
// the screen off (background.ts, #108): it keeps the points itself, and an open screen hears of each; the web asks
// the browser (geo.web.ts).
import type { Geo } from "./recorder";
import { startBackground, stopBackground } from "./background";
import { pointEvents, staleBackground } from "./headless";

/** Positions for the walk that started at `startedAt` (the notification says since when). */
export function recordingGeo(startedAt: string): Geo {
  return {
    watch(walkKey, onPoint, onDenied) {
      // a start Android refuses (the app went to the background meanwhile) counts as no GPS; the next open tries again
      void startBackground(walkKey, startedAt).then((s) => (s === "denied" ? onDenied() : undefined), onDenied);
      return pointEvents.subscribe(onPoint);
    },
    end: stopBackground,
  };
}

/** Stops a background recording that is no longer this phone's (headless.ts `staleBackground`). */
export const stopStaleBackground = (running: string | null, mine: boolean): Promise<void> => (staleBackground(running, mine) ? stopBackground() : Promise.resolve());
