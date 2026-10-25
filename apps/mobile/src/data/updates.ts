// The Android app's updates from its own server (#107, ADR 0015): expo-updates asks the server the app signed in to
// (the override takes effect only after the app is closed and opened again, so it asks for that once), checks at the
// start and whenever the app comes back to the front, and applies a new update at once, unless this phone records a
// walk: then it waits for the first look after the walk (a return to the front, or the next start), so nothing
// reloads under the recorder's last batch or the walk's summary. When the server's runtime differs from the app's, it says which side is behind.
// The web app updates through its service worker (updates.web.ts).
import type { Client } from "@gassi/api-client";
import * as Updates from "expo-updates";
import { useSyncExternalStore } from "react";
import { events } from "./events";
import { storage } from "./storage";
import appJson from "../../app.json";
import { apkUrl, isNewUpdate, needsRestart, reloadNow, updateUrlFor, versionGap } from "./updatePolicy";

export type UpdateNotice = { kind: "restart" } | { kind: "older"; url: string | null } | { kind: "newer" } | null;

const KEY = "gassi.updateUrl"; // the override set last (not under the kept prefix: a sign-out keeps it)
let notice: UpdateNotice = null;
const listeners = new Set<() => void>();
const tell = (n: UpdateNotice) => {
  notice = n;
  listeners.forEach((fn) => fn());
};

/** Points the updates at `serverUrl`; the first time for a server, the app has to be restarted for it. */
export function pointUpdatesAt(serverUrl: string): void {
  if (!Updates.isEnabled) return;
  const wanted = updateUrlFor(serverUrl);
  if (!needsRestart(storage.getItem(KEY), wanted, appJson.expo.updates.url)) return;
  try {
    Updates.setUpdateURLAndRequestHeadersOverride({ updateUrl: wanted, requestHeaders: {} });
    storage.setItem(KEY, wanted);
    tell({ kind: "restart" });
  } catch (e) {
    events.error("Update", e);
  }
}

/** Looks for an update the app doesn't run yet and applies it, unless this phone records a walk (asked again later). */
export async function checkForUpdate(recording: boolean): Promise<void> {
  if (!Updates.isEnabled || notice?.kind === "restart" || !reloadNow(recording)) return;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable || !isNewUpdate(check.manifest?.id, Updates.updateId)) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch (e) {
    events.error("Update", e);
  }
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
