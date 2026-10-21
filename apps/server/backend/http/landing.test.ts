import { expect, test } from "vitest";
import { Links } from "../auth/links";
import { freshDatabase, HIRSCH } from "../db/testing";
import { landing } from "./landing";
import { TEST_CODE_KEY } from "./testing";

const { db } = freshDatabase();
const NOW = new Date("2026-10-20T10:00:00Z");
const URL_ = "https://gassi.example";

test("a working link: what it is for, the app link and a QR code of it, its code and the way into the web app", async () => {
  const { token, code } = await new Links(db(), () => NOW, URL_, TEST_CODE_KEY).create({ kind: "person", createdBy: HIRSCH.id, ttlMs: 60_000 });
  const page = await landing(db(), () => NOW, URL_, TEST_CODE_KEY, token);
  expect(page).toMatchObject({ valid: true, title: "Du bist zu Gassi eingeladen", appLink: `gassi://join?server=https%3A%2F%2Fgassi.example&token=${token}`, code, webLink: `${URL_}/join?token=${token}` });
  expect(page.valid && page.qr).toContain("<svg");
});

test("a used or unknown link says so, without app link or QR code", async () => {
  const gone = { valid: false, title: "Dieser Link ist abgelaufen oder schon benutzt.", hint: "Bitte um einen neuen Link." };
  expect(await landing(db(), () => NOW, URL_, TEST_CODE_KEY, "unknown")).toEqual(gone);
  const links = new Links(db(), () => NOW, URL_, TEST_CODE_KEY);
  const { token } = await links.create({ kind: "device", personId: HIRSCH.id, ttlMs: 60_000 });
  await links.redeem({ token }, { deviceKind: "phone", deviceName: "iPad" });
  expect(await landing(db(), () => NOW, URL_, TEST_CODE_KEY, token)).toEqual(gone);
});
