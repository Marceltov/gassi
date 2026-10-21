import { describe, expect, test } from "vitest";
import type { TrackPoint } from "@gassi/domain";
import { Devices } from "./auth/devices";
import { freshDatabase, HERZII, HIRSCH } from "./db/testing";
import { InputError } from "./errors";
import { Sessions } from "./sessions";
import { Tracks } from "./tracks";

const { db } = freshDatabase();
const NOW = new Date("2026-10-20T12:00:00Z");
const tracks = () => new Tracks(db(), () => NOW);
const sessions = () => new Sessions({ db: db(), names: new Map([[HIRSCH.id, HIRSCH.name], [HERZII.id, HERZII.name]]), now: () => NOW });
const pt = (s: number, north: number): TrackPoint => ({ t: new Date(Date.parse("2026-10-20T09:00:00Z") + s * 1000).toISOString(), lat: 48.137 + north / 111_195, lon: 11.575, ele: null, acc: 5 });
const device = async (personId: string, kind: "phone" | "watch") => (await new Devices(db(), () => NOW).create(personId, { kind, name: kind })).device.id;

async function walk(key = "w") {
  await sessions().apply(HIRSCH, [{ id: `start-${key}`, at: "2026-10-20T09:00:00.000Z", kind: "walk.start", walkKey: key }]);
  return (await db().selectFrom("entry").select("id").where("client_key", "=", key).executeTakeFirstOrThrow()).id;
}

describe("Tracks", () => {
  test("batches are joined in seq order, and a batch sent twice is stored once", async () => {
    const entryId = await walk();
    const phone = await device(HIRSCH.id, "phone");
    const t = tracks();
    expect(await t.addBatch(phone, { trackId: "tr1", walkKey: "w", source: "phone", seq: 2, points: [pt(600, 1000)] })).toEqual({ stored: true });
    expect(await t.addBatch(phone, { trackId: "tr1", walkKey: "w", source: "phone", seq: 1, points: [pt(0, 0), pt(300, 500)] })).toEqual({ stored: true });
    expect(await t.addBatch(phone, { trackId: "tr1", walkKey: "w", source: "phone", seq: 1, points: [pt(0, 0), pt(300, 500)] })).toEqual({ stored: false });
    const shown = await t.forWalk(entryId);
    expect(shown?.source).toBe("phone");
    expect(Math.round(shown!.metrics.distanceM)).toBe(1000);
    expect(shown!.points.map((p) => p.t)).toEqual([pt(0, 0).t, pt(600, 1000).t]); // simplified: a straight line
  });

  test("the watch track is shown, even when a phone recorded a longer one", async () => {
    const entryId = await walk();
    await tracks().addBatch(await device(HIRSCH.id, "phone"), { trackId: "p", walkKey: "w", source: "phone", seq: 1, points: [pt(0, 0), pt(600, 2000)] });
    await tracks().addBatch(await device(HIRSCH.id, "watch"), { trackId: "wt", walkKey: "w", source: "watch", seq: 1, points: [pt(0, 0), pt(600, 1500)] });
    expect((await tracks().forWalk(entryId))?.source).toBe("watch");
  });

  test("a batch for an alias key of a joined walk lands on that walk", async () => {
    const entryId = await walk("w1");
    await sessions().apply(HERZII, [{ id: "her-start", at: "2026-10-20T09:01:00.000Z", kind: "walk.start", walkKey: "w2" }]);
    await tracks().addBatch(await device(HERZII.id, "phone"), { trackId: "hers", walkKey: "w2", source: "phone", seq: 1, points: [pt(0, 0), pt(60, 100)] });
    expect(await tracks().forWalk(entryId)).not.toBeNull();
  });

  test("a batch for a walk nobody started is refused", async () => {
    await expect(tracks().addBatch(await device(HIRSCH.id, "phone"), { trackId: "x", walkKey: "nope", source: "phone", seq: 1, points: [pt(0, 0)] })).rejects.toThrow(new InputError("Diese Runde gibt es nicht."));
  });

  test("a track id already used for another walk is refused, not attached to it", async () => {
    await walk("w1");
    const phone = await device(HIRSCH.id, "phone");
    await tracks().addBatch(phone, { trackId: "track-1", walkKey: "w1", source: "phone", seq: 0, points: [pt(0, 0)] });
    await sessions().apply(HIRSCH, [{ id: "stop-w1", at: "2026-10-20T09:30:00.000Z", kind: "walk.stop", walkKey: "w1" }, { id: "start-w2", at: "2026-10-20T10:00:00.000Z", kind: "walk.start", walkKey: "w2" }]);
    await expect(tracks().addBatch(phone, { trackId: "track-1", walkKey: "w2", source: "phone", seq: 0, points: [pt(3600, 0)] })).rejects.toThrow(new InputError("Diese Strecke gehört zu einer anderen Runde."));
  });

  test("a walk without a track has none", async () => {
    expect(await tracks().forWalk(await walk())).toBeNull();
  });
});
