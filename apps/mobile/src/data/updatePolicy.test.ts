import { expect, test } from "vitest";
import { apkUrl, needsRestart, reloadNow, updateUrlFor, versionGap } from "./updatePolicy";

test("updateUrlFor: the update endpoint of the server signed in to", () => {
  expect(updateUrlFor("https://gassi.herziis.de")).toBe("https://gassi.herziis.de/api/updates/manifest");
  expect(updateUrlFor("http://192.168.178.162:10040/")).toBe("http://192.168.178.162:10040/api/updates/manifest");
});

test("needsRestart: only when the app asks another server than the one it should", () => {
  expect(needsRestart("https://a/api/updates/manifest", "https://a/api/updates/manifest")).toBe(false);
  expect(needsRestart("https://a/api/updates/manifest", "https://b/api/updates/manifest")).toBe(true);
  expect(needsRestart(null, "https://b/api/updates/manifest")).toBe(true);
});

test("versionGap: which side is behind, by number", () => {
  expect(versionGap("1", "2")).toBe("older");
  expect(versionGap("10", "9")).toBe("newer");
  expect(versionGap("2", "2")).toBeNull();
  expect(versionGap("1", null)).toBeNull(); // a server without an update says nothing
});

test("reloadNow: at once, but not while this phone records a walk", () => {
  expect(reloadNow(false)).toBe(true);
  expect(reloadNow(true)).toBe(false);
});

test("apkUrl: the release of a runtime", () => {
  expect(apkUrl("2")).toBe("https://github.com/Marceltov/gassi/releases/download/apk-2/gassi-2.apk");
});
