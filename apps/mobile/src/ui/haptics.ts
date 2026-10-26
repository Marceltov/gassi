// A short buzz on the taps that log or start something (#121), through Android's own touch feedback (it follows the
// phone's setting for it): a key's click on a tap, the long press's on a hold. haptics.web.ts is the web's.
import { AndroidHaptics, performAndroidHapticsAsync } from "expo-haptics";

export function feel(hold: boolean): void {
  void performAndroidHapticsAsync(hold ? AndroidHaptics.Long_Press : AndroidHaptics.Virtual_Key).catch(() => undefined);
}
