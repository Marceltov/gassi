// Recording on Android with the screen off (#108): expo-location's foreground service ("Runde läuft") delivers
// positions to a task that runs with or without the app's screen, even after Android ended it; headless.ts does the
// work. The task is defined when the bundle loads (index.ts), as a headless start needs. The notification's line can
// only change while the app is in the foreground (expo-location refuses a service start from the background), so it
// says since when and how far as of the last time the app was open.
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { apiFor } from "../data/api";
import { loadDevice } from "../data/device";
import { backgroundWalk, beginBackground, clearBackground, distanceOf, type Location as Delivered, locationOptions, notificationBody, onLocations, pointEvents, queuedFor, stopWhenSignedOut } from "./headless";
import { uploadWith } from "./recorder";

const TASK = "gassi-recording";

TaskManager.defineTask<{ locations: Delivered[] }>(TASK, async ({ data, error }) => {
  if (error || !data) return;
  const device = loadDevice();
  await onLocations(data.locations, {
    now: () => Date.now(),
    // signed out: the kept walk is gone too (kept.ts), so the task stops before it sends
    upload: device ? uploadWith(apiFor(device)) : () => Promise.reject(new Error("signed out")),
    stopService: stopService,
    queued: (walkKey) => !!device && queuedFor(device.person.id, walkKey),
    onPoint: pointEvents.emit,
  });
});

async function stopService(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
}

stopWhenSignedOut(stopService);

const options = (body: string): Location.LocationTaskOptions => ({ accuracy: Location.Accuracy.High, ...locationOptions(body) });

/** Starts (or goes on with) recording `walkKey` here; "denied" when location isn't allowed. Asks for notifications
 * once (Android 13+): without them the service runs, its notification hidden. */
export async function startBackground(walkKey: string, startedAt: string): Promise<"on" | "denied"> {
  if (!(await Location.requestForegroundPermissionsAsync()).granted) return "denied";
  if (Platform.OS === "android" && Number(Platform.Version) >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  beginBackground(walkKey, startedAt);
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
