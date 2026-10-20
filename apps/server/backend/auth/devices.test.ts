import { describe, expect, test } from "vitest";
import { freshDatabase, HERZII, HIRSCH } from "../db/testing";
import { Devices } from "./devices";
import { hashToken } from "./tokens";

const { db } = freshDatabase();
let clock = new Date("2026-10-20T10:00:00Z");
const devices = () => new Devices(db(), () => clock);

describe("Devices", () => {
  test("a device signs in with its token; only the token's hash is stored", async () => {
    const { token, device } = await devices().create(HIRSCH.id, { kind: "phone", name: "iPhone" });
    expect(token).toMatch(/^[\w-]{43}$/);
    const row = await db().selectFrom("device").selectAll().executeTakeFirstOrThrow();
    expect(row.token_hash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    clock = new Date("2026-10-20T11:00:00Z");
    expect(await devices().authenticate(`Bearer ${token}`)).toEqual({ person: HIRSCH, device: { id: device.id, kind: "phone", name: "iPhone" } });
    expect((await devices().list(HIRSCH.id))[0]).toMatchObject({ id: device.id, lastSeenAt: "2026-10-20T11:00:00.000Z" });
  });

  test("a missing, malformed or unknown token signs in nobody", async () => {
    expect(await devices().authenticate(null)).toBeNull();
    expect(await devices().authenticate("Basic abc")).toBeNull();
    expect(await devices().authenticate("Bearer nope")).toBeNull();
  });

  test("a person lists and removes only their own devices", async () => {
    const mine = await devices().create(HIRSCH.id, { kind: "phone", name: "iPhone" });
    const hers = await devices().create(HERZII.id, { kind: "phone", name: "Pixel" });
    expect((await devices().list(HIRSCH.id)).map((d) => d.name)).toEqual(["iPhone"]);
    expect(await devices().remove(HIRSCH.id, hers.device.id)).toBe(false);
    expect(await devices().remove(HIRSCH.id, mine.device.id)).toBe(true);
    expect(await devices().authenticate(`Bearer ${mine.token}`)).toBeNull();
    expect(await devices().authenticate(`Bearer ${hers.token}`)).not.toBeNull();
  });
});
