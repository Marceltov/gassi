import { afterEach, describe, expect, test } from "vitest";
import { freshDatabase, HERZII } from "../db/testing";
import { logTo } from "../log";
import { apiCaller } from "./testing";

const { db } = freshDatabase();
const NOW = new Date("2026-10-24T21:00:00Z");
let restore = () => {};
afterEach(() => restore());

describe("errors from the app", () => {
  test("go to the server's log, one line each, with who and which device", async () => {
    const lines: Record<string, unknown>[] = [];
    restore = logTo((line) => void lines.push(JSON.parse(line)));
    const { json, tokenFor } = apiCaller(db, () => NOW);
    const token = await tokenFor(HERZII.id);
    const errors = [
      { at: "2026-10-24T20:59:00.000Z", part: "Runde und Training", message: "Die Antwort passt nicht (walk.key: …)." },
      { at: "2026-10-24T20:59:30.000Z", part: "Absturz", message: "TypeError: x is undefined" },
    ];
    expect(await json("/api/client-errors", { method: "POST", token, body: { errors, version: "0.3.0" } })).toEqual({ status: 200, body: { received: 2 } });
    const logged = lines.filter((l) => l.component === "client-error");
    expect(logged).toEqual([
      expect.objectContaining({ level: "warn", person: "Herzii", device: "Testgerät", kind: "phone", version: "0.3.0", ...errors[0] }),
      expect.objectContaining({ level: "warn", person: "Herzii", device: "Testgerät", kind: "phone", version: "0.3.0", ...errors[1] }),
    ]);
  });

  test("need a signed-in device", async () => {
    const { json } = apiCaller(db, () => NOW);
    const body = { errors: [{ at: NOW.toISOString(), part: "Senden", message: "x" }], version: "0.3.0" };
    expect((await json("/api/client-errors", { method: "POST", body })).status).toBe(401);
  });
});
