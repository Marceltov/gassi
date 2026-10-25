import { describe, expect, test } from "vitest";
import { freshDatabase } from "../db/testing";
import { apiCaller } from "./testing";

const { db } = freshDatabase();
const NOW = new Date("2026-10-25T12:00:00Z");

describe("/api/app", () => {
  test("says which runtime the server's update is for, without a sign-in", async () => {
    const { json } = apiCaller(db, () => NOW, () => ({ update: () => ({ manifest: "{}", signature: null, runtimeVersion: "1" }) }));
    expect(await json("/api/app")).toEqual({ status: 200, body: { runtimeVersion: "1" } });
  });

  test("null when the server has no update", async () => {
    const { json } = apiCaller(db, () => NOW, () => ({ update: () => null }));
    expect(await json("/api/app")).toEqual({ status: 200, body: { runtimeVersion: null } });
  });
});
