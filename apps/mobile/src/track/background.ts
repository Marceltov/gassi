// Recording on Android with the screen off (#108): expo-location's foreground service ("Runde läuft") delivers
// positions to a task that runs with or without the app's screen, even after Android ended it; headless.ts does the
// work. The task is defined when the bundle loads (index.ts), as a headless start needs. The notification's line can
// only change while the app is in the foreground (expo-location refuses a service start from the background), so it
// says since when and how far as of the last time the app was open. A service started while the app isn't on screen
// (it went away during the permission dialogs) got only network fixes with the screen off (#127): it starts once the
// app is visible again.
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { apiFor } from "../data/api";
import { loadDevice } from "../data/device";
import { events, taskEvents } from "../data/events";
import { backgroundWalk, beginBackground, clearBackground, distanceOf, type Location as Delivered, locationOptions, notificationBody, onLocations, pointEvents, queuedFor, stopWhenSignedOut } from "./headless";
import { uploadWith } from "./recorder";

const TASK = "gassi-recording";

TaskManager.defineTask<{ locations: Delivered[] }>(TASK, async ({ data, error }) => {
  if (error) taskEvents.error("Aufnahme", error);
  if (error || !data) return;
  const device = loadDevice();
  try {
    await onLocations(data.locations, {
      now: () => Date.now(),
      // signed out: the kept walk is gone too (kept.ts), so the task stops before it sends
      upload: device ? uploadWith(apiFor(device), taskEvents) : () => Promise.reject(new Error("signed out")),
      stopService: stopService,
      queued: (walkKey) => !!device && queuedFor(device.person.id, walkKey),
      onPoint: pointEvents.emit,
    });
  } catch (e) {
    // kept for the server like any error; the next delivery tries again
    taskEvents.error("Aufnahme", e);
  }
});

async function stopService(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
}

stopWhenSignedOut(stopService);

const options = (body: string): Location.LocationTaskOptions => ({ accuracy: Location.Accuracy.High, ...locationOptions(body) });

// resolves once the app is on screen
const visible = (): Promise<void> =>
  new Promise((resolve) => {
    if (AppState.currentState === "active") return resolve();
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      sub.remove();
      resolve();
    });
  });

/** Starts (or goes on with) recording `walkKey` here; "denied" when location isn't allowed. Asks for notifications
 * once (Android 13+): without them the service runs, its notification hidden. Records what location allows (precise
 * or approximate, always or while in use), so rough routes can be told apart on the server. */
export async function startBackground(walkKey: string, startedAt: string): Promise<"on" | "denied"> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return "denied";
  if (Platform.OS === "android" && Number(Platform.Version) >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  const always = (await Location.getBackgroundPermissionsAsync()).granted;
  events.record("track", "permission", { precise: permission.android?.accuracy === "fine", always });
  beginBackground(walkKey, startedAt);
  await visible();
  // the walk ended (or another began) while the app was away
  if (backgroundWalk()?.walkKey !== walkKey) return "on";
  await Location.startLocationUpdatesAsync(TASK, options(notificationBody(startedAt, distanceOf(walkKey))));
  return "on";
}

/** Ends recording here (the walk is over); a recording begun meanwhile (a new walk started at once) keeps the service. */
export async function stopBackground(): Promise<void> {
  clearBackground();
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) if (!backgroundWalk()) await Location.stopLocationUpdatesAsync(TASK);
}

// back in the foreground: the notification's line catches up
AppState.addEventListener("change", (state) => {
  const b = backgroundWalk();
  if (state !== "active" || !b) return;
  void Location.hasStartedLocationUpdatesAsync(TASK).then((on) => (on ? Location.startLocationUpdatesAsync(TASK, options(notificationBody(b.startedAt, distanceOf(b.walkKey)))) : undefined)).catch(() => {});
});
