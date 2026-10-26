import { expect, test } from "vitest";
import { loadDevice } from "./device";
import { linkKind, needsName, normalizeServer, serverHost, signIn, signInOptions, typedServer } from "./signin";
import { fakeServer, status } from "./testing";

test("a person or setup link asks for a name, a device link doesn't", async () => {
  const server = fakeServer({ "GET /api/auth/link": (_, url) => ({ kind: url.searchParams.get("code") === "abcd efgh" ? "person" : "device" }) });
  expect(await linkKind("", { code: "abcd efgh" }, server.fetch)).toBe("person");
  expect(await linkKind("", { token: "x" }, server.fetch)).toBe("device");
  expect([needsName("setup"), needsName("person"), needsName("device"), needsName("magic")]).toEqual([true, true, false, false]);
});

test("signing in with a code keeps the device's token; a used code says why", async () => {
  const server = fakeServer({
    "POST /api/auth/redeem": (body) =>
      (body as { code: string }).code === "used" ? status(400, { error: "Dieser Link ist abgelaufen oder schon benutzt." }) : { deviceToken: "dev-1", person: { id: "p", name: "Herzii" }, device: { id: 3, kind: "web", name: "iPhone (Web)" } },
  });
  const urls: string[] = [];
  const fetchFn: typeof fetch = (input, init) => {
    urls.push(String(input));
    return server.fetch(input, init);
  };
  await signIn("https://g.example", { code: "abcd efgh" }, { personName: "Herzii" }, fetchFn);
  expect(urls[0]).toBe("https://g.example/api/auth/redeem");
  expect(server.calls[0].body).toMatchObject({ code: "abcd efgh", deviceKind: "web", personName: "Herzii" });
  expect((server.calls[0].body as { deviceName: string }).deviceName).toMatch(/\(Web\)$/);
  expect(loadDevice()).toEqual({ token: "dev-1", serverUrl: "https://g.example", person: { id: "p", name: "Herzii" } });
  await expect(signIn("https://g.example", { code: "used" }, {}, fetchFn)).rejects.toThrow("Dieser Link ist abgelaufen oder schon benutzt.");
});

test("the sign-in asks the server whether OIDC is set up; out of reach, it offers only the code", async () => {
  const server = fakeServer({ "GET /api/auth/options": () => ({ oidc: true, mail: false }) });
  expect(await signInOptions("", server.fetch)).toEqual({ oidc: true, mail: false });
  server.reachable = false;
  expect(await signInOptions("", server.fetch)).toEqual({ oidc: false, mail: false });
});

test("normalizeServer: a typed address becomes the server's origin", () => {
  expect(normalizeServer(" gassi.example.org/ ")).toBe("https://gassi.example.org");
  expect(normalizeServer("http://192.168.178.162:3000/")).toBe("http://192.168.178.162:3000");
  expect(normalizeServer("https://a.b")).toBe("https://a.b");
});

test("normalizeServer: a pasted link keeps only its server", () => {
  expect(normalizeServer("gassi.example.org/join?token=abc")).toBe("https://gassi.example.org");
  expect(normalizeServer("https://gassi.example.org:8443/mehr/haushalt#x")).toBe("https://gassi.example.org:8443");
  expect(normalizeServer("gassi.example.org?token=abc")).toBe("https://gassi.example.org");
});

test("typedServer: what the field holds, as a server, at every keystroke; nothing while it's empty", () => {
  expect(typedServer("")).toBeNull();
  expect(typedServer("  ")).toBeNull();
  expect(typedServer("gassi.example.org/join?token=abc")).toBe("https://gassi.example.org");
});

test("serverHost: the server's host, the page's for the web app, null when neither is known", () => {
  expect(serverHost("https://gassi-dev.herziis.de", undefined)).toBe("gassi-dev.herziis.de");
  expect(serverHost("http://192.168.178.162:3000", "https://x.y")).toBe("192.168.178.162:3000");
  expect(serverHost("", "https://gassi.herziis.de")).toBe("gassi.herziis.de");
  expect(serverHost("", undefined)).toBeNull();
});
