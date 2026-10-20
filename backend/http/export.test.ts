import { expect, test } from "vitest";
import { sessionCookie } from "../auth/session";
import { parseUsers } from "../config";
import { freshDatabase } from "../db/testing";
import { Diary } from "../diary";
import { withEnv } from "../testing/env";
import { exportRoute } from "./export";

withEnv();
const { db } = freshDatabase();
const NOW = Date.parse("2026-10-20T10:00:00Z");
const open = async () => new Diary({ db: db(), dog: { id: 1, name: "Toffee" }, users: parseUsers("marcel:Hirsch"), timeZone: "Europe/Berlin", now: () => new Date(NOW) });
const signedIn = () => ({ cookie: sessionCookie("marcel", NOW).split(";")[0] });

test("401 without a session", async () => {
  expect((await exportRoute(new Request("https://gassi.example/export.csv"), open, NOW)).status).toBe(401);
});

test("a CSV download of every entry, named by today's date", async () => {
  await (await open()).log({ username: "marcel", name: "Hirsch" }, { type: "pee", at: "2026-10-20T09:00:00Z" });
  const res = await exportRoute(new Request("https://gassi.example/export.csv", { headers: signedIn() }), open, NOW);
  expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
  expect(res.headers.get("content-disposition")).toBe('attachment; filename="gassi-2026-10-20.csv"');
  expect(await res.text()).toContain("2026-10-20;11:00;Pipi;;;;Hirsch");
});
