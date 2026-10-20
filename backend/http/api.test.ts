import { describe, expect, test } from "vitest";
import { freshDatabase } from "../db/testing";
import { Diary } from "../diary";
import { setEnv, withEnv } from "../testing/env";
import { apiEntriesRoute } from "./api";

const TOKEN = "api-token-".padEnd(32, "z");
withEnv({ API_TOKEN: TOKEN });
const { db } = freshDatabase();
const NOW = new Date("2026-10-20T10:00:00Z");
const open = async () => new Diary({ db: db(), dog: { id: 1, name: "Toffee" }, names: new Map([["marcel", "Hirsch"], ["bille", "Herzii"]]), timeZone: "Europe/Berlin", now: () => NOW });

const URL_ = "https://gassi.example/api/v1/entries";
const auth = (token = TOKEN) => ({ authorization: `Bearer ${token}` });
const get = (query = "", headers: HeadersInit = auth()) => apiEntriesRoute(new Request(`${URL_}${query}`, { headers }), open, () => NOW);
const post = (body: unknown, headers: HeadersInit = auth()) =>
  apiEntriesRoute(new Request(URL_, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body) }), open, () => NOW);

describe("auth", () => {
  test("404 while API_TOKEN is not set", async () => {
    setEnv({ API_TOKEN: undefined });
    expect((await get()).status).toBe(404);
    expect((await post({})).status).toBe(404);
  });

  test("401 with a wrong or missing token", async () => {
    expect((await get("", auth("wrong"))).status).toBe(401);
    const res = await get("", {});
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe("Bearer");
  });
});

describe("POST", () => {
  test("takes the new types and fields: a walk with its end, food with its kind, a weight", async () => {
    const walk = await post({ loggedBy: "marcel", type: "walk", at: "2026-10-20T08:00:00Z", endedAt: "2026-10-20T08:45:00Z" });
    expect(await walk.json()).toMatchObject({ type: "walk", endedAt: "2026-10-20T08:45:00.000Z", durationMin: 45, walkers: [] });
    expect(await (await post({ loggedBy: "marcel", type: "food", foodKind: "dry", amountG: 80 })).json()).toMatchObject({ foodKind: "dry", amountG: 80 });
    expect((await post({ loggedBy: "marcel", type: "weight", amountG: 12_400 })).status).toBe(201);
    expect((await post({ loggedBy: "marcel", type: "walk", at: "2026-10-20T08:00:00Z", endedAt: "2026-10-20T07:00:00Z" })).status).toBe(400);
    const listed = (await (await get("?type=walk")).json()).entries;
    expect(listed[0]).toMatchObject({ endedAt: "2026-10-20T08:45:00.000Z", durationMin: 45 });
  });

  test("logs for a known user, now unless `at` is given", async () => {
    const res = await post({ loggedBy: "bille", type: "food", amountG: 150 });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ type: "food", amountG: 150, at: NOW.toISOString(), loggedBy: "bille", byName: "Herzii" });
  });

  test.each([[{ loggedBy: "mallory", type: "walk" }], [{ loggedBy: "marcel", type: "bark" }], [{ loggedBy: "marcel", type: "walk", at: "soon" }], [[1]]])("400 for %j", async (body) => {
    expect((await post(body)).status).toBe(400);
  });
});

describe("GET", () => {
  test("lists newest first, by type and since", async () => {
    await post({ loggedBy: "marcel", type: "walk", at: "2026-10-20T07:00:00Z" });
    await post({ loggedBy: "marcel", type: "pee", at: "2026-10-20T08:00:00Z" });
    await post({ loggedBy: "marcel", type: "walk", at: "2026-10-20T09:00:00Z" });
    const ats = async (q: string) => ((await (await get(q)).json()) as { entries: { at: string }[] }).entries.map((e) => e.at.slice(11, 13));
    expect(await ats("")).toEqual(["09", "08", "07"]);
    expect(await ats("?type=walk")).toEqual(["09", "07"]);
    expect(await ats("?since=2026-10-20T10:00:00%2B02:00")).toEqual(["09", "08"]);
  });

  test.each(["?type=bark", "?since=yesterday"])("400 for %s", async (q) => {
    expect((await get(q)).status).toBe(400);
  });
});
