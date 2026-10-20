import { describe, expect, test } from "vitest";
import { freshDatabase, HIRSCH } from "../db/testing";
import { InputError } from "../errors";
import { appLink, ensureSetupLink, Links } from "./links";
import { Devices } from "./devices";

const URL_ = "https://gassi.example";
const DAY = 86_400_000;

describe("setup", () => {
  const { db } = freshDatabase({ empty: true });
  const clock = new Date("2026-10-20T10:00:00Z");
  const links = () => new Links(db(), () => clock, URL_);

  test("a fresh server prints its setup link, and a new one on each start until someone set it up", async () => {
    const lines: string[] = [];
    const first = await ensureSetupLink(db(), URL_, (l) => lines.push(l), () => clock);
    expect(lines).toEqual([`Gassi einrichten: ${first}`]);
    const second = await ensureSetupLink(db(), URL_, (l) => lines.push(l), () => clock);
    expect(second).not.toBe(first);
    await expect(links().redeem(first!.split("/l/")[1], { deviceKind: "phone", deviceName: "iPhone", personName: "Hirsch", dogName: "Toffee" })).rejects.toThrow(InputError);
    await links().redeem(second!.split("/l/")[1], { deviceKind: "phone", deviceName: "iPhone", personName: "Hirsch", dogName: "Toffee" });
    expect(await ensureSetupLink(db(), URL_, (l) => lines.push(l), () => clock)).toBeNull();
    expect(lines).toHaveLength(2);
  });

  test("setup creates the first person, their first dog and a device", async () => {
    const { token } = await links().create({ kind: "setup", ttlMs: 7 * DAY });
    const r = await links().redeem(token, { deviceKind: "phone", deviceName: "iPhone", personName: " Hirsch ", dogName: "Toffee" });
    expect(r.person.name).toBe("Hirsch");
    expect(await db().selectFrom("dog").select(["name", "color"]).execute()).toEqual([{ name: "Toffee", color: "#b8691a" }]);
    expect(await new Devices(db(), () => clock).authenticate(`Bearer ${r.deviceToken}`)).toMatchObject({ person: r.person, device: { kind: "phone", name: "iPhone" } });
  });

  test("setup takes DOG_NAME when the dog's name isn't given", async () => {
    const { token } = await new Links(db(), () => clock, URL_, "Bello").create({ kind: "setup", ttlMs: DAY });
    await new Links(db(), () => clock, URL_, "Bello").redeem(token, { deviceKind: "phone", deviceName: "iPhone", personName: "Hirsch" });
    expect(await db().selectFrom("dog").select("name").execute()).toEqual([{ name: "Bello" }]);
  });

  test("a rejected redeem leaves nothing behind", async () => {
    const { token } = await links().create({ kind: "setup", ttlMs: DAY });
    await expect(links().redeem(token, { deviceKind: "phone", deviceName: "iPhone", personName: "Hirsch" })).rejects.toThrow(InputError);
    for (const table of ["person", "dog", "device"] as const) expect(await db().selectFrom(table).selectAll().execute()).toEqual([]);
    expect(await links().peek(token)).toEqual({ kind: "setup", valid: true });
  });

  test("with OIDC there is no setup link: the provider lets the first person in", async () => {
    const lines: string[] = [];
    expect(await ensureSetupLink(db(), URL_, (l) => lines.push(l), () => clock, { oidc: true })).toBeNull();
    expect(lines).toEqual(["Gassi wird über OIDC eingerichtet: die erste Anmeldung über den Anbieter legt den Haushalt an."]);
  });

  test("setup needs a name and the dog's name", async () => {
    const { token } = await links().create({ kind: "setup", ttlMs: DAY });
    await expect(links().redeem(token, { deviceKind: "phone", deviceName: "iPhone", personName: "", dogName: "Toffee" })).rejects.toThrow(new InputError("Wie heißt du?"));
    await expect(links().redeem(token, { deviceKind: "phone", deviceName: "iPhone", personName: "Hirsch" })).rejects.toThrow(new InputError("Wie heißt dein Hund?"));
  });
});

describe("invites", () => {
  const { db } = freshDatabase();
  let clock = new Date("2026-10-20T10:00:00Z");
  const links = () => new Links(db(), () => clock, URL_);

  test("a link works once", async () => {
    const { token, url } = await links().create({ kind: "person", createdBy: HIRSCH.id, ttlMs: 7 * DAY });
    expect(url).toBe(`${URL_}/l/${token}`);
    const herzii = await links().redeem(token, { deviceKind: "phone", deviceName: "Pixel", personName: "Herzii" });
    expect(herzii.person.name).toBe("Herzii");
    await expect(links().redeem(token, { deviceKind: "phone", deviceName: "Pixel", personName: "Mallory" })).rejects.toThrow(new InputError("Dieser Link ist abgelaufen oder schon benutzt."));
  });

  test("an expired link is refused", async () => {
    const { token } = await links().create({ kind: "device", personId: HIRSCH.id, ttlMs: 7 * DAY });
    clock = new Date(clock.getTime() + 7 * DAY + 1);
    await expect(links().redeem(token, { deviceKind: "phone", deviceName: "iPad" })).rejects.toThrow(InputError);
  });

  test("a revoked link is refused, and only its creator can revoke it", async () => {
    const { token, id } = await links().create({ kind: "person", createdBy: HIRSCH.id, ttlMs: DAY });
    expect(await links().revoke("bille", id)).toBe(false);
    expect(await links().revoke(HIRSCH.id, id)).toBe(true);
    await expect(links().redeem(token, { deviceKind: "phone", deviceName: "Pixel", personName: "Herzii" })).rejects.toThrow(InputError);
  });

  test("a device invite adds a device to the inviting person", async () => {
    const { token } = await links().create({ kind: "watch", personId: HIRSCH.id, createdBy: HIRSCH.id, ttlMs: DAY });
    const r = await links().redeem(token, { deviceKind: "watch", deviceName: "Forerunner 165", personName: "ignored" });
    expect(r.person).toEqual(HIRSCH);
    expect(r.device).toMatchObject({ kind: "watch", name: "Forerunner 165" });
  });

  test("open invites are listed for their creator until used", async () => {
    const a = await links().create({ kind: "person", createdBy: HIRSCH.id, ttlMs: DAY });
    await links().create({ kind: "device", personId: HIRSCH.id, createdBy: HIRSCH.id, ttlMs: DAY });
    expect((await links().open(HIRSCH.id)).map((l) => l.kind).sort()).toEqual(["device", "person"]);
    await links().redeem(a.token, { deviceKind: "phone", deviceName: "Pixel", personName: "Herzii" });
    expect((await links().open(HIRSCH.id)).map((l) => l.kind)).toEqual(["device"]);
  });

  test("peek says what a link is for without using it", async () => {
    const { token } = await links().create({ kind: "person", createdBy: HIRSCH.id, ttlMs: DAY });
    expect(await links().peek(token)).toEqual({ kind: "person", valid: true });
    expect(await links().peek("unknown")).toEqual({ kind: null, valid: false });
  });
});

test("the app link carries the server and the token", () => {
  expect(appLink("https://gassi.example", "abc")).toBe("gassi://join?server=https%3A%2F%2Fgassi.example&token=abc");
});
