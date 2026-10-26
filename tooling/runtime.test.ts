import { describe, expect, it } from "vitest";
import { checkRuntime } from "../scripts/runtime.mjs";

describe("checkRuntime", () => {
  it("passes when the fingerprint recorded for the runtime is the current one", () => {
    expect(checkRuntime({ runtimeVersion: "1", versionCode: 1, recorded: { "1": "abc" }, fingerprint: "abc" })).toBeNull();
  });

  it("fails when native parts changed under the same runtime, saying what to do", () => {
    expect(checkRuntime({ runtimeVersion: "1", versionCode: 1, recorded: { "1": "abc" }, fingerprint: "def" })).toBe(
      "Native parts changed: bump runtimeVersion in apps/mobile/app.json and record the fingerprint (npm run runtime:record).",
    );
  });

  it("fails for a runtime without a recorded fingerprint", () => {
    expect(checkRuntime({ runtimeVersion: "2", versionCode: 2, recorded: { "1": "abc" }, fingerprint: "def" })).toBe(
      "Runtime 2 has no recorded fingerprint: run npm run runtime:record.",
    );
  });

  it("fails when Android's versionCode isn't the runtime version", () => {
    expect(checkRuntime({ runtimeVersion: "2", versionCode: 1, recorded: { "2": "abc" }, fingerprint: "abc" })).toBe(
      "android.versionCode (1) must be the runtime version (2) in apps/mobile/app.json.",
    );
  });
});
