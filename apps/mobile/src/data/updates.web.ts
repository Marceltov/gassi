// The web app updates through its service worker (ADR 0007); nothing here. Same interface as updates.ts.
import type * as Native from "./updates.ts";

export type UpdateNotice = Native.UpdateNotice;
export const pointUpdatesAt = (): void => {};
export const checkForUpdate = async (): Promise<void> => {};
export const applyPending = async (): Promise<void> => {};
export const compareRuntime = async (): Promise<void> => {};
export const useUpdateNotice = (): UpdateNotice => null;

const sameAsNative: typeof Native = { pointUpdatesAt, checkForUpdate, applyPending, compareRuntime, useUpdateNotice };
void sameAsNative;
