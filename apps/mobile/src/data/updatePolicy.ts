// When the Android app takes its update from its server (#107, ADR 0015), as plain rules: where it asks, whether a
// restart is due for that, which side is behind when the runtimes differ, and when a downloaded update is applied.

/** The update endpoint of the server signed in to. */
export const updateUrlFor = (serverUrl: string): string => `${serverUrl.replace(/\/+$/, "")}/api/updates/manifest`;

/** Whether the app asks another server than the one it signed in to: the override takes effect only after a restart. */
export const needsRestart = (current: string | null, wanted: string): boolean => current !== wanted;

/** Which side is behind: "older" (install the new APK), "newer" (the server isn't updated yet), or null. */
export function versionGap(app: string, server: string | null): "older" | "newer" | null {
  if (server === null || Number(app) === Number(server)) return null;
  return Number(app) < Number(server) ? "older" : "newer";
}

/** A downloaded update is applied at once, unless this phone records a walk (then at its end). */
export const reloadNow = (recording: boolean): boolean => !recording;

/** The APK of a runtime, as CI publishes it (GitHub release apk-<runtime>). */
export const apkUrl = (runtime: string): string => `https://github.com/Marceltov/gassi/releases/download/apk-${runtime}/gassi-${runtime}.apk`;
