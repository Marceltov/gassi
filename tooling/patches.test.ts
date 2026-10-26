import { describe, expect, it } from "vitest";
import { patchStates, patchTarget } from "../scripts/patches.mjs";

describe("patchTarget", () => {
  it("reads the package and version from the file name", () => {
    expect(patchTarget("expo-updates+58.0.18.patch")).toEqual({ name: "expo-updates", version: "58.0.18" });
  });

  it("turns a scoped package's + back into its slash", () => {
    expect(patchTarget("@expo+fingerprint+0.15.1.patch")).toEqual({ name: "@expo/fingerprint", version: "0.15.1" });
  });
});

describe("patches", () => {
  // An upgrade of a patched package fails here, before the next APK is built without the fix.
  it("each fits the installed package (applied, or ready for the EAS build to apply)", () => {
    for (const { file, state } of patchStates()) expect([file, ["applied", "ready"].includes(state) ? "fits" : state]).toEqual([file, "fits"]);
  });
});
