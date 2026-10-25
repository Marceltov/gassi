// The browser records only while the page is open and has no such settings (hints.ts): nothing to explain.
import type * as Native from "./hints.ts";

export const hintsSupported = (): boolean => false;
export const backgroundAllowed = async (): Promise<boolean> => false;
export const askAlways = async (): Promise<boolean> => false;
export const batteryUnrestricted = async (): Promise<boolean> => false;
export const askBattery = async (): Promise<void> => {};

const sameAsNative: typeof Native = { hintsSupported, backgroundAllowed, askAlways, batteryUnrestricted, askBattery };
void sameAsNative;
