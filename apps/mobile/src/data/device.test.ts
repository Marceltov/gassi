import { expect, test } from "vitest";
import { HIRSCH } from "./testing";
import { clearDevice, loadDevice, saveDevice, subscribeDevice } from "./device";

test("the device survives a reload and is gone once cleared", () => {
  expect(loadDevice()).toBeNull();
  saveDevice({ token: "t1", serverUrl: "", person: HIRSCH });
  expect(localStorage.getItem("gassi.device")).not.toBeNull();
  expect(loadDevice()).toEqual({ token: "t1", serverUrl: "", person: HIRSCH });
  // the same object while nothing changed (React's useSyncExternalStore needs that)
  expect(loadDevice()).toBe(loadDevice());
  clearDevice();
  expect(loadDevice()).toBeNull();
});

test("broken storage content counts as signed out", () => {
  localStorage.setItem("gassi.device", "{nope");
  expect(loadDevice()).toBeNull();
  localStorage.setItem("gassi.device", JSON.stringify({ serverUrl: "", person: HIRSCH }));
  expect(loadDevice()).toBeNull();
  // from before the person was kept with the device: sign in again
  localStorage.setItem("gassi.device", JSON.stringify({ token: "t", serverUrl: "" }));
  expect(loadDevice()).toBeNull();
});

test("subscribers hear about sign-in and sign-out", () => {
  const seen: (string | null)[] = [];
  const stop = subscribeDevice(() => seen.push(loadDevice()?.token ?? null));
  saveDevice({ token: "t1", serverUrl: "", person: HIRSCH });
  clearDevice();
  stop();
  saveDevice({ token: "t2", serverUrl: "", person: HIRSCH });
  expect(seen).toEqual(["t1", null]);
});

test("a device saved under gassi.device before the fold still loads", () => {
  const device = { token: "t", serverUrl: "", person: { id: "p", name: "Herzii" } };
  localStorage.setItem("gassi.device", JSON.stringify(device));
  expect(loadDevice()).toEqual(device);
});
