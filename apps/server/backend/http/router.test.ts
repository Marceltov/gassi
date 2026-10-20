import { describe, expect, test } from "vitest";
import { Devices } from "../auth/devices";
import { freshDatabase, HIRSCH } from "../db/testing";
import { apiRouter } from "./api";

const { db } = freshDatabase();
const NOW = new Date("2026-10-20T10:00:00Z");
const handle = () => apiRouter({ db: db(), now: () => NOW, publicUrl: "https://gassi.example", oidc: false, mailer: null });
const call = (path: string, init: RequestInit & { token?: string } = {}) =>
  handle()(new Request(`https://gassi.example${path}`, { ...init, headers: { "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) } }));
const phone = () => new Devices(db(), () => NOW).create(HIRSCH.id, { kind: "phone", name: "iPhone" });

describe("the API router", () => {
  test("answers 401 without a token", async () => {
    const res = await call("/api/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Bitte anmelden." });
  });

  test("me returns the person, the device and what the household has set up", async () => {
    const { token, device } = await phone();
    const res = await call("/api/me", { token });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ person: HIRSCH, device: { id: device.id, kind: "phone", name: "iPhone" }, household: { oidc: false, mail: false } });
  });

  test("400 on invalid input, 404 on an unknown path", async () => {
    const { token } = await phone();
    expect((await call("/api/devices/abc", { method: "DELETE", token })).status).toBe(400);
    expect((await call("/api/nothing", { token })).status).toBe(404);
    expect((await call("/api/me", { method: "POST", token })).status).toBe(404);
  });

  test("a removed device is signed out at once", async () => {
    const { token, device } = await phone();
    expect(await (await call(`/api/devices/${device.id}`, { method: "DELETE", token })).json()).toEqual({ removed: true });
    expect((await call("/api/me", { token })).status).toBe(401);
  });

  test("lists the person's devices, marking the one asking", async () => {
    const a = await phone();
    await phone();
    const { devices } = await (await call("/api/devices", { token: a.token })).json();
    expect(devices).toHaveLength(2);
    expect(devices.find((d: { id: number }) => d.id === a.device.id)).toMatchObject({ current: true, kind: "phone", name: "iPhone" });
  });
});
