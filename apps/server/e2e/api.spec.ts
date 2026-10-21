// The API as the apps will use it: through the typed client, from the setup link to a joint walk with a track.
import { readFileSync, writeFileSync } from "node:fs";
import { ApiError, createClient } from "@gassi/api-client";
import { expect, test } from "@playwright/test";
import { BASE_URL, SETUP_LINK_FILE, TOKEN_FILE } from "../playwright.config";

const client = (token?: string) => createClient({ baseUrl: BASE_URL, token });
const tokenOf = (url: string) => url.split("/l/")[1];
const setupLink = () => readFileSync(SETUP_LINK_FILE, "utf8").trim().split("\n").at(-1)!.replace(/^.*: /, "");

test("a fresh server: set up, invite, walk together with two dogs, record a track, sign a device out", async () => {
  // Hirsch sets the server up with the link from the log
  const hirsch = await client().redeem({ token: tokenOf(setupLink()), deviceKind: "phone", deviceName: "iPhone", personName: "Hirsch", dogName: "Toffee" });
  writeFileSync(TOKEN_FILE, hirsch.deviceToken);
  const asHirsch = client(hirsch.deviceToken);
  expect(await asHirsch.me()).toMatchObject({ person: { name: "Hirsch" }, household: { oidc: false, mail: false } });
  await expect(client().redeem({ token: tokenOf(setupLink()), deviceKind: "phone", deviceName: "x", personName: "Mallory", dogName: "X" })).rejects.toEqual(new ApiError(400, "Dieser Link ist abgelaufen oder schon benutzt."));

  // and invites Herzii
  const invite = await asHirsch.createInvite({ kind: "person" });
  const herzii = await client().redeem({ token: tokenOf(invite.url), deviceKind: "phone", deviceName: "Pixel 7", personName: "Herzii" });
  const asHerzii = client(herzii.deviceToken);

  // a second dog, then a walk with both, joined by Herzii, Bruno pees
  const bruno = await asHirsch.addDog({ name: "Bruno", color: "#3a6fc0" });
  const toffee = (await asHirsch.dogs()).dogs.find((d) => d.name === "Toffee")!;
  const t = (min: number) => new Date(Date.now() - (30 - min) * 60_000).toISOString();
  await asHirsch.commands({ commands: [{ id: "s", at: t(0), kind: "walk.start", walkKey: "w1" }] });
  await asHerzii.commands({ commands: [{ id: "j", at: t(1), kind: "walk.join", walkKey: "w1" }, { id: "p", at: t(5), kind: "log", type: "pee", dogId: bruno.id }] });
  const view = await asHirsch.sessions();
  expect(view.walk).toMatchObject({ key: "w1", dogIds: [toffee.id, bruno.id].sort((a, b) => a - b), walkers: [{ name: "Hirsch" }, { name: "Herzii" }] });

  // the phone's track, then home
  const point = (min: number, north: number) => ({ t: t(min), lat: 48.137 + north / 111_195, lon: 11.575, ele: 520, acc: 4 });
  expect(await asHerzii.uploadTrack({ trackId: "herzii-1", walkKey: "w1", source: "phone", seq: 0, points: [point(1, 0), point(10, 600), point(20, 1200)] })).toEqual({ stored: true });
  await asHirsch.commands({ commands: [{ id: "e", at: t(25), kind: "walk.stop", walkKey: "w1" }] });
  const walkEntry = (await asHirsch.entries({ type: "walk" })).entries[0];
  const walk = await asHirsch.walk({ id: walkEntry.id });
  expect(walk.summary).toMatchObject({ totalMin: 25, pee: 1 });
  expect(Math.round(walk.track!.metrics.distanceM)).toBe(1200);

  // Herzii signs her phone out: its token stops working at once
  await asHerzii.removeDevice({ id: herzii.device.id });
  await expect(asHerzii.me()).rejects.toEqual(new ApiError(401, "Bitte anmelden."));
});
