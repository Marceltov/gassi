// The browser's screen wake lock: taken while a recording walk runs with "Bildschirm auf der Runde anlassen" on. The
// browser lets go of it when the page is hidden, so it is taken again when the page comes back. Same interface as
// wakeLock.ts ("./wakeLock" means this file on the web, so that one is named with its extension).
import type * as Native from "./wakeLock.ts";

type Lock = { release(): Promise<void> };
type WakeLock = { request(type: "screen"): Promise<Lock> };
const wakeLock = (): WakeLock | null => (typeof navigator !== "undefined" && "wakeLock" in navigator ? (navigator.wakeLock as WakeLock) : null);

export const wakeLockSupported = (): boolean => wakeLock() !== null;

export function holdScreen(): () => void {
  let lock: Lock | null = null;
  let done = false;
  const take = async () => {
    const api = wakeLock();
    if (!api || done || document.visibilityState !== "visible") return;
    try {
      const taken = await api.request("screen");
      if (done) void taken.release();
      else lock = taken;
    } catch {
      // refused (battery saver, not visible after all): the screen goes off as usual
    }
  };
  const onVisible = () => void take();
  document.addEventListener("visibilitychange", onVisible);
  void take();
  return () => {
    done = true;
    document.removeEventListener("visibilitychange", onVisible);
    void lock?.release();
  };
}

const sameAsNative: typeof Native = { wakeLockSupported, holdScreen };
void sameAsNative;
