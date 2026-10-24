// What recording in the pocket needs from Android's settings (#108): location "Immer zulassen" (Android 11+ offers it
// only in the settings) and the battery left unrestricted (One UI also puts unused apps to sleep). The screens that
// explain them are src/more/LocationHint.tsx and BatteryHint.tsx; the web has none of this (hints.web.ts).
import Constants from "expo-constants";
import * as Battery from "expo-battery";
import * as IntentLauncher from "expo-intent-launcher";
import * as Location from "expo-location";
import { Linking } from "react-native";

const PACKAGE = Constants.expoConfig?.android?.package ?? "io.github.marceltov.gassi";

/** Whether this device has these settings (Mehr shows their rows, the first recording opens Akku). */
export const hintsSupported = (): boolean => true;

export const backgroundAllowed = async (): Promise<boolean> => (await Location.getBackgroundPermissionsAsync()).granted;

/** Opens the app's location permission (Android 11+ shows the page with "Immer zulassen"); true once it's set. */
export const askAlways = async (): Promise<boolean> => (await Location.requestBackgroundPermissionsAsync()).granted;

export const batteryUnrestricted = async (): Promise<boolean> => !(await Battery.isBatteryOptimizationEnabledAsync());

/** Android's own question "Im Hintergrund ausführen lassen?" for this app. */
export async function askBattery(): Promise<void> {
  await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, { data: `package:${PACKAGE}` });
}

/** The battery settings, where One UI keeps "Hintergrundnutzungslimits"; the app's settings where a phone has none. */
export async function openBatterySettings(): Promise<void> {
  try {
    await IntentLauncher.startActivityAsync("android.intent.action.POWER_USAGE_SUMMARY");
  } catch {
    await Linking.openSettings();
  }
}
