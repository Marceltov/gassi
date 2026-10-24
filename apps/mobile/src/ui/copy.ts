// Copying text for the user (an invite's link or code), on Android with expo-clipboard. copy.web.ts is the web's.
import { setStringAsync } from "expo-clipboard";

/** Whether this platform can copy. */
export const canCopy = (): boolean => true;

/** Copies `text`; false when it didn't work. */
export async function copyText(text: string): Promise<boolean> {
  try {
    return await setStringAsync(text);
  } catch {
    return false;
  }
}
