import { expect, test } from "vitest";
import { loadDevice } from "./device";
import { deviceName, linkKind, needsName, signIn, signInOptions } from "./signin";
import { fakeServer, status } from "./testing";

test("the device is named after the phone, for the list of devices", () => {
  expect(deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15")).toBe("iPhone (Web)");
  expect(deviceName("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("iPad (Web)");
  expect(deviceName("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")).toBe("Android (Web)");
  expect(deviceName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("Mac (Web)");
  expect(deviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Windows (Web)");
  expect(deviceName("")).toBe("Browser (Web)");
});

test("a person or setup link asks for a name, a device link doesn't", async () => {
  const server = fakeServer({ "GET /api/auth/link": (_, url) => ({ kind: url.searchParams.get("code") === "abcd efgh" ? "person" : "device" }) });
  expect(await linkKind({ code: "abcd efgh" }, server.fetch)).toBe("person");
  expect(await linkKind({ token: "x" }, server.fetch)).toBe("device");
  expect([needsName("setup"), needsName("person"), needsName("device"), needsName("magic")]).toEqual([true, true, false, false]);
});

test("signing in with a code keeps the device's token; a used code says why", async () => {
  const server = fakeServer({
    "POST /api/auth/redeem": (body) =>
      (body as { code: string }).code === "used" ? status(400, { error: "Dieser Link ist abgelaufen oder schon benutzt." }) : { deviceToken: "dev-1", person: { id: "p", name: "Herzii" }, device: { id: 3, kind: "web", name: "iPhone (Web)" } },
  });
  await signIn({ code: "abcd efgh" }, { personName: "Herzii" }, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", server.fetch);
  expect(server.calls[0].body).toEqual({ code: "abcd efgh", deviceKind: "web", deviceName: "iPhone (Web)", personName: "Herzii" });
  expect(loadDevice()).toEqual({ token: "dev-1", serverUrl: "" });
  await expect(signIn({ code: "used" }, {}, "", server.fetch)).rejects.toThrow("Dieser Link ist abgelaufen oder schon benutzt.");
});

test("the sign-in asks the server whether OIDC is set up; out of reach, it offers only the code", async () => {
  const server = fakeServer({ "GET /api/auth/options": () => ({ oidc: true, mail: false }) });
  expect(await signInOptions(server.fetch)).toEqual({ oidc: true, mail: false });
  server.reachable = false;
  expect(await signInOptions(server.fetch)).toEqual({ oidc: false, mail: false });
});
