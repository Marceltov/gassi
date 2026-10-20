import { expect, test } from "vitest";
import { freshDatabase } from "../db/testing";
import { healthRoute } from "./health";

const { db } = freshDatabase();

test("200 ok when the database answers", async () => {
  const res = await healthRoute(async () => db());
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});

test("503 when it doesn't", async () => {
  const res = await healthRoute(() => Promise.reject(new Error("disk gone")));
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ status: "unavailable" });
});

test("503 when the query fails", async () => {
  await db().destroy();
  expect((await healthRoute(async () => db())).status).toBe(503);
});
