// Sharing text through the system's share menu (an invite to WhatsApp, Signal, mail), on Android with React Native's
// Share. share.web.ts is the web's.
import { Share } from "react-native";

/** Whether this platform has a share menu. */
export const canShare = (): boolean => true;

/** Opens the share menu with `text`; false when it didn't open (closing it without choosing is no failure). */
export async function shareText(text: string): Promise<boolean> {
  try {
    await Share.share({ message: text });
    return true;
  } catch {
    return false;
  }
}
