// No buzz on the web: the iPhone's Safari has no vibration for pages. Same interface as haptics.ts ("./haptics" means
// this file on the web, so that one is named with its extension).
import type * as Native from "./haptics.ts";

export function feel(): void {}

const sameAsNative: typeof Native = { feel };
void sameAsNative;
