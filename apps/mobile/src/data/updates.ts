// The Android app's updates from its own server (#107, ADR 0015): expo-updates asks the server the app signed in to
// (the override takes effect only after the app is closed and opened again, so it asks for that once), checks at the
// start and whenever the app comes back to the front, and applies a downloaded update at once, unless this phone
// records a walk (then at its end). When the server's runtime differs from the app's, it says which side is behind.
// The web app updates through its service worker (updates.web.ts).
import type { Client } from "@gassi/api-client";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useSyncExternalStore } from "react";
import { events } from "./events";
import { storage } from "./storage";
import { apkUrl, needsRestart, reloadNow, updateUrlFor, versionGap } from "./updatePolicy";

export type UpdateNotice = { kind: "restart" } | { kind: "older"; url: string | null } | { kind: "newer" } | null;

const KEY = "gassi.updateUrl"; // the override set last (not under the kept prefix: a sign-out keeps it)
let notice: UpdateNotice = null;
let pending = false; // an update downloaded during a recorded walk
const listeners = new Set<() => void>();
const tell = (n: UpdateNotice) => {
  notice = n;
  listeners.forEach((fn) => fn());
};

/** Points the updates at `serverUrl`; the first time for a server, the app has to be restarted for it. */
export function pointUpdatesAt(serverUrl: string): void {
  if (!Updates.isEnabled) return;
  const wanted = updateUrlFor(serverUrl);
  const current = storage.getItem(KEY) ?? (Constants.expoConfig?.updates?.url as string | undefined) ?? null;
  if (!needsRestart(current, wanted)) return;
  try {
    Updates.setUpdateURLAndRequestHeadersOverride({ updateUrl: wanted, requestHeaders: {} });
    storage.setItem(KEY, wanted);
    tell({ kind: "restart" });
  } catch (e) {
    events.error("Update", e);
  }
}

/** Looks for an update and applies it: at once, or (while this phone records a walk) at the walk's end. */
export async function checkForUpdate(recording: boolean): Promise<void> {
  if (!Updates.isEnabled || notice?.kind === "restart") return;
  try {
    if (!(await Updates.checkForUpdateAsync()).isAvailable) return;
    await Updates.fetchUpdateAsync();
    if (reloadNow(recording)) await Updates.reloadAsync();
    else pending = true;
  } catch (e) {
    events.error("Update", e);
  }
}

/** The walk recorded here is over: an update that waited for it is applied now. */
export async function applyPending(): Promise<void> {
  if (!pending) return;
  pending = false;
  await Updates.reloadAsync().catch((e: unknown) => events.error("Update", e));
}

/** Compares the app's runtime with the server's: a new APK to install (with its link once the release exists), or a
 * server that is behind. */
export async function compareRuntime(api: Client): Promise<void> {
  const app = Updates.runtimeVersion;
  if (!Updates.isEnabled || !app || notice?.kind === "restart") return;
  try {
    const server = (await api.appInfo()).runtimeVersion;
    const gap = versionGap(app, server);
    if (gap === "older" && server) {
      const url = apkUrl(server);
      const there = await fetch(url, { method: "HEAD" }).then((r) => r.ok, () => false);
      tell({ kind: "older", url: there ? url : null });
    } else tell(gap === "newer" ? { kind: "newer" } : null);
  } catch {
    // no reception: asked again at the next start or return to the front
  }
}

/** What the version line on every screen says (VersionBanner). */
export function useUpdateNotice(): UpdateNotice {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    () => notice,
    () => notice,
  );
}
