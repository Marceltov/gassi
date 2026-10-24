// The browser's position as it changes, with its accuracy; asked for once (the browser shows its prompt on the first
// walk). Positions come only while the page is open and the screen is on. Same interface as geo.ts ("./geo" means
// this file on the web, so that one is named with its extension).
import type { TrackPoint } from "@gassi/domain";
import type * as Native from "./geo.ts";
import type { Geo } from "./recorder";

const DENIED = 1; // GeolocationPositionError.PERMISSION_DENIED

function watchPosition(_walkKey: string, onPoint: (p: TrackPoint) => void, onDenied: () => void): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(
    ({ coords, timestamp }) => onPoint({ t: new Date(timestamp).toISOString(), lat: coords.latitude, lon: coords.longitude, ele: coords.altitude ?? null, acc: coords.accuracy ?? null }),
    (e) => {
      if (e.code === DENIED) onDenied(); // no fix or a timeout: the walk shows "kein GPS-Signal" by itself
    },
    { enableHighAccuracy: true, maximumAge: 0 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** The browser records only while the page is open, so there is nothing to end beyond the watching. */
export const recordingGeo = (): Geo => ({ watch: watchPosition });

/** The browser's recording can't be ended behind the app's back. */
export const backgroundStopped = async (): Promise<boolean> => false;

/** Nothing records in the background here. */
export const stopStaleBackground = async (): Promise<void> => {};

const sameAsNative: typeof Native = { recordingGeo, backgroundStopped, stopStaleBackground };
void sameAsNative;
