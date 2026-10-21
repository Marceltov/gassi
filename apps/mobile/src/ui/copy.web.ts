// Copying on the web: the Clipboard API, there only in a secure context (https or localhost). Same interface as
// copy.ts ("./copy" means this file on the web, so that one is named with its extension).
import type * as Native from "./copy.ts";

export const canCopy = (): boolean => typeof navigator !== "undefined" && !!navigator.clipboard?.writeText;

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false; // not allowed (no user gesture, a denied permission)
  }
}

const sameAsNative: typeof Native = { canCopy, copyText };
void sameAsNative;
