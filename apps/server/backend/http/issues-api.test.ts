import { describe, expect, test } from "vitest";
import { REPORT_LIMITS, Throttle } from "../auth/throttle";
import { freshDatabase, HERZII } from "../db/testing";
import { type Fetch, Issues } from "../issues";
import { apiCaller } from "./testing";

const { db } = freshDatabase();
const NOW = new Date("2026-10-20T12:00:00Z");
const created: unknown[] = [];
// GitHub with no issues yet, filing each report as number 1
const fetchFn: Fetch = async (_url, init) => {
  if (init?.method !== "POST") return Response.json([]);
  created.push(JSON.parse(String(init.body)));
  return Response.json({ number: 1, title: "Konsistenz", state: "open", html_url: "https://github.com/o/r/issues/1", created_at: NOW.toISOString(), closed_at: null, labels: [{ name: "bug" }, { name: "from-app" }] });
};
const report = { kind: "bug", title: "Konsistenz", text: "", version: "0.3.0" };

describe("Wünsche und Fehler over the API", () => {
  test("not configured: me says so and both endpoints are 404", async () => {
    const { json, tokenFor } = apiCaller(db, () => NOW);
    const token = await tokenFor(HERZII.id);
    expect((await json("/api/me", { token })).body.household.issues).toBe(false);
    expect((await json("/api/issues", { token })).status).toBe(404);
    expect((await json("/api/issues", { method: "POST", token, body: report })).status).toBe(404);
  });

  test("configured: lists, files as the person and device, refuses an empty title, and too many reports in a row", async () => {
    const issues = new Issues("o/r", "t", fetchFn);
    const reportThrottle = new Throttle(REPORT_LIMITS);
    const { json, tokenFor } = apiCaller(db, () => NOW, () => ({ issues, reportThrottle }));
    const token = await tokenFor(HERZII.id);
    expect((await json("/api/me", { token })).body.household.issues).toBe(true);
    expect((await json("/api/issues", { token })).body).toEqual({ issues: [] });
    expect(await json("/api/issues", { method: "POST", token, body: { ...report, title: " " } })).toEqual({ status: 400, body: { error: "Worum geht es? Kurz, höchstens 120 Zeichen." } });
    expect((await json("/api/issues", { method: "POST", token, body: report })).body).toMatchObject({ number: 1, kind: "bug", fromApp: true });
    expect(created[0]).toMatchObject({ body: "From Herzii in the app · Testgerät · Gassi 0.3.0" });
    for (let i = 1; i < REPORT_LIMITS.client.burst; i++) await json("/api/issues", { method: "POST", token, body: report });
    expect((await json("/api/issues", { method: "POST", token, body: report })).status).toBe(429);
  });
});
