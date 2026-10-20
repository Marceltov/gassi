import { describe, expect, test } from "vitest";
import { Devices } from "../auth/devices";
import { freshDatabase, HIRSCH } from "../db/testing";
import { apiRouter, type ApiDeps } from "./api";

const { db } = freshDatabase();
const NOW = new Date("2026-10-20T10:00:00Z");
const deps = (more: Partial<ApiDeps> = {}): ApiDeps => ({ db: db(), now: () => NOW, publicUrl: "https://gassi.example", oidc: false, mail: false, ...more });
const call = (path: string, init: { method?: string; token?: string; body?: unknown } = {}, more: Partial<ApiDeps> = {}) =>
  apiRouter(deps(more))(
    new Request(`https://gassi.example${path}`, {
      method: init.method ?? "GET",
      headers: { "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
const hirschPhone = async () => (await new Devices(db(), () => NOW).create(HIRSCH.id, { kind: "phone", name: "iPhone" })).token;

describe("invites over the API", () => {
  test("Hirsch invites a person; Herzii redeems the link and is in", async () => {
    const token = await hirschPhone();
    const invite = await (await call("/api/invites", { method: "POST", token, body: { kind: "person" } })).json();
    expect(invite).toMatchObject({ url: expect.stringMatching(/^https:\/\/gassi\.example\/l\/[\w-]+$/), appLink: expect.stringMatching(/^gassi:\/\/join\?server=/) });
    const linkToken = invite.url.split("/l/")[1];
    const res = await call("/api/auth/redeem", { method: "POST", body: { token: linkToken, deviceKind: "phone", deviceName: "Pixel 7", personName: "Herzii" } });
    expect(res.status).toBe(200);
    const redeemed = await res.json();
    expect(redeemed.person.name).toBe("Herzii");
    expect(await (await call("/api/me", { token: redeemed.deviceToken })).json()).toMatchObject({ person: { name: "Herzii" }, device: { name: "Pixel 7" } });
  });

  test("a used link answers 400 with the German message", async () => {
    const token = await hirschPhone();
    const { url } = await (await call("/api/invites", { method: "POST", token, body: { kind: "device" } })).json();
    const body = { token: url.split("/l/")[1], deviceKind: "phone", deviceName: "iPad" };
    expect((await call("/api/auth/redeem", { method: "POST", body })).status).toBe(200);
    const again = await call("/api/auth/redeem", { method: "POST", body });
    expect(again.status).toBe(400);
    expect(await again.json()).toEqual({ error: "Dieser Link ist abgelaufen oder schon benutzt." });
  });

  test("person invites are refused in OIDC mode", async () => {
    const token = await hirschPhone();
    const res = await call("/api/invites", { method: "POST", token, body: { kind: "person" } }, { oidc: true });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Neue Personen kommen über die Anmeldung herein." });
    expect((await call("/api/invites", { method: "POST", token, body: { kind: "watch" } }, { oidc: true })).status).toBe(200);
  });

  test("open invites are listed and can be revoked", async () => {
    const token = await hirschPhone();
    const { id } = await (await call("/api/invites", { method: "POST", token, body: { kind: "person" } })).json();
    expect((await (await call("/api/invites", { token })).json()).invites).toEqual([{ id, kind: "person", createdAt: NOW.toISOString(), expiresAt: "2026-10-27T10:00:00.000Z" }]);
    expect(await (await call(`/api/invites/${id}`, { method: "DELETE", token })).json()).toEqual({ revoked: true });
    expect((await (await call("/api/invites", { token })).json()).invites).toEqual([]);
  });

  test("a person changes their name and e-mail address", async () => {
    const token = await hirschPhone();
    expect(await (await call("/api/me", { method: "PATCH", token, body: { name: "Marcel", email: "marcel@example.org" } })).json()).toEqual({ person: { id: HIRSCH.id, name: "Marcel", email: "marcel@example.org" } });
    expect((await call("/api/me", { method: "PATCH", token, body: { email: "kein-mail" } })).status).toBe(400);
  });
});
