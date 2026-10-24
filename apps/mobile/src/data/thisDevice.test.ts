import { expect, test } from "vitest";
import { API_URL } from "./api";
import { deviceName, linkedServer } from "./thisDevice.web";

test("the device is named after the phone, for the list of devices", () => {
  expect(deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15")).toBe("iPhone (Web)");
  expect(deviceName("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("iPad (Web)");
  expect(deviceName("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")).toBe("Android (Web)");
  expect(deviceName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("Mac (Web)");
  expect(deviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Windows (Web)");
  expect(deviceName("")).toBe("Browser (Web)");
});

test("linkedServer: the web app talks to the server that serves it, whatever the link says", () => {
  expect(linkedServer("https://other.example")).toBe(API_URL);
  expect(linkedServer(undefined)).toBe(API_URL);
});
