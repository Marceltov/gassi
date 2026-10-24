// The phone's position as it changes, for recording a walk's route (recorder.ts). The web asks the browser
// (geo.web.ts); the Android app (step 3) brings background recording next to this file. Until then a native build
// gets no positions, and the walk says "kein GPS-Signal".
import type { TrackPoint } from "@gassi/domain";

type OnPoint = (p: TrackPoint) => void;

/** Calls `onPoint` with each new position and `onDenied` when location is refused; returns the stop. */
export const watchPosition: (onPoint: OnPoint, onDenied: () => void) => () => void = () => () => {};
