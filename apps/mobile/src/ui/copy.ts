// Copying text for the user (an invite's link or code). On Android this comes with expo-clipboard in step 3; until
// then there is nothing to copy with and the buttons stay away. copy.web.ts is the web's.

/** Whether this platform can copy. */
export const canCopy = (): boolean => false;

/** Copies `text`; false when it didn't work. */
export async function copyText(text: string): Promise<boolean> {
  void text;
  return false;
}
