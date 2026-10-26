// Sharing on the web: the Web Share API, where the browser has it (Safari on the iPhone, Chrome on Android), only in a
// secure context. Same interface as share.ts ("./share" means this file on the web, so that one is named with its
// extension).
import type * as Native from "./share.ts";

export const canShare = (): boolean => typeof navigator !== "undefined" && typeof navigator.share === "function";

export async function shareText(text: string): Promise<boolean> {
  try {
    await navigator.share({ text });
    return true;
  } catch (e) {
    return e instanceof DOMException && e.name === "AbortError"; // closed without choosing
  }
}

const sameAsNative: typeof Native = { canShare, shareText };
void sameAsNative;
