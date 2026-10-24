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
const at = (s: number) => new Date(Date.parse("2026-10-20T09:00:00Z") + s * 1000).toISOString();
// a walk north at 1.4 m/s from `from` to `to` seconds, a point every 5 s, `east` metres east
const line = (from: number, to: number, east: number): TrackPoint[] =>
  Array.from({ length: (to - from) / 5 + 1 }, (_, i) => {
    const s = from + i * 5;
    return { t: at(s), lat: 48.137 + (s * 1.4) / 111_195, lon: 11.575 + east / (111_195 * Math.cos((48.137 * Math.PI) / 180)), ele: null, acc: 5 };
  });
const recorder = (entryId: number, deviceId: number, s: number) => db().insertInto("walk_recorder").values({ entry_id: entryId, device_id: deviceId, from_at: at(s) }).execute();
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

  test("shows the recorders' pieces joined and filtered", async () => {
    const entryId = await walk();
    const [mine, hers] = [await device(HIRSCH.id, "phone"), await device(HERZII.id, "phone")];
    await recorder(entryId, mine, 0);
    await recorder(entryId, hers, 600);
    // both record 20 minutes, 1.4 m/s north; hers 40 m east of mine to tell them apart
    await tracks().addBatch(mine, { trackId: "mine", walkKey: "w", source: "phone", seq: 0, points: line(0, 1200, 0) });
    await tracks().addBatch(hers, { trackId: "hers", walkKey: "w", source: "phone", seq: 0, points: line(0, 1200, 40) });
    const shown = (await tracks().forWalk(entryId))!;
    const east = (p: TrackPoint) => (p.lon - 11.575) * 111_195 * Math.cos((48.137 * Math.PI) / 180);
    expect(shown.points.filter((p) => p.t < at(590)).every((p) => Math.abs(east(p)) < 5)).toBe(true);
    expect(shown.points.filter((p) => p.t > at(700)).every((p) => Math.abs(east(p) - 40) < 5)).toBe(true);
    expect(Math.abs(shown.metrics.distanceM - 1680)).toBeLessThan(100);
  });

  test("a handover arriving late cuts the old phone's late points", async () => {
    const entryId = await walk();
    const [mine, hers] = [await device(HIRSCH.id, "phone"), await device(HERZII.id, "phone")];
    await recorder(entryId, mine, 0);
    await tracks().addBatch(mine, { trackId: "mine", walkKey: "w", source: "phone", seq: 0, points: line(0, 1200, 0) });
    await recorder(entryId, hers, 600); // heard of only now
    const shown = (await tracks().forWalk(entryId))!;
    expect(shown.points.every((p) => p.t <= at(600))).toBe(true);
  });

  test("no usable points: no track", async () => {
    const entryId = await walk();
    await tracks().addBatch(await device(HIRSCH.id, "phone"), { trackId: "bad", walkKey: "w", source: "phone", seq: 0, points: line(0, 600, 0).map((p) => ({ ...p, acc: 60 })) });
    expect(await tracks().forWalk(entryId)).toBeNull();
  });

  test("a batch for an ended walk is still stored", async () => {
    const entryId = await walk();
    await sessions().apply(HIRSCH, [{ id: "stop", at: at(1200), kind: "walk.stop", walkKey: "w" }]);
    expect(await tracks().addBatch(await device(HIRSCH.id, "phone"), { trackId: "late", walkKey: "w", source: "phone", seq: 0, points: line(0, 600, 0) })).toEqual({ stored: true });
    expect(await tracks().forWalk(entryId)).not.toBeNull();
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
