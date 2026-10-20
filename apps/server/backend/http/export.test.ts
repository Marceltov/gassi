import { expect, test } from "vitest";
import { freshDatabase, HIRSCH } from "../db/testing";
import { apiCaller } from "./testing";
import { exportCsv } from "./export";

const { db } = freshDatabase();
const NOW = new Date("2026-10-20T10:00:00Z");
const { json, tokenFor } = apiCaller(db, () => NOW);
const get = (headers: Record<string, string> = {}) => exportCsv(new Request("https://gassi.example/export.csv", { headers }), { db: db(), now: () => NOW, timeZone: "Europe/Berlin" });

test("CSV needs a token", async () => {
  expect((await get()).status).toBe(401);
  expect((await get({ authorization: "Bearer nope" })).status).toBe(401);
});

test("CSV lists every entry with its dogs and a walk's distance, named by today's date", async () => {
  const token = await tokenFor(HIRSCH.id);
  await json("/api/commands", { method: "POST", token, body: { commands: [{ id: "s", at: "2026-10-20T09:00:00.000Z", kind: "walk.start", walkKey: "w" }, { id: "e", at: "2026-10-20T09:20:00.000Z", kind: "walk.stop", walkKey: "w" }] } });
  const pt = (s: number, north: number) => ({ t: new Date(Date.parse("2026-10-20T09:00:00Z") + s * 1000).toISOString(), lat: 48.137 + north / 111_195, lon: 11.575, ele: null, acc: null });
  await json("/api/tracks", { method: "POST", token, body: { trackId: "t", walkKey: "w", source: "phone", seq: 0, points: [pt(0, 0), pt(600, 1500)] } });
  const res = await get({ authorization: `Bearer ${token}` });
  expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
  expect(res.headers.get("content-disposition")).toBe('attachment; filename="gassi-2026-10-20.csv"');
  expect(await res.text()).toContain("2026-10-20;11:00;Gassi;Toffee;2026-10-20 11:20;20;;;;;;1,5;;Hirsch");
});
