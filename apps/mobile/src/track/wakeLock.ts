// Keeping the screen on while this phone records a walk (#104), so the route goes on in the pocket. The web asks the
// browser (wakeLock.web.ts); the Android app records with the screen off and needs none, so here there is nothing.

/** Whether this device can keep its screen on (Mehr shows the switch only then). */
export const wakeLockSupported = (): boolean => false;

/** Keeps the screen on until the returned function is called. */
export const holdScreen = (): (() => void) => () => {};
