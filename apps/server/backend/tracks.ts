// GPS tracks of walks, as the recording phone or watch sends them: batches of points with a sequence number, so a
// batch sent twice is stored once and batches sent late (no reception) fall into place. A walk may have several
// tracks (both walkers recorded); it shows one (chooseTrack: the watch's, else the longest).
import { chooseTrack, simplify, type TrackMetrics, trackMetrics, type TrackPoint, type TrackSource } from "@gassi/domain";
import type { DB } from "./db/open";
import { InputError } from "./errors";
import { findByKey } from "./sessions";

export type Batch = { trackId: string; walkKey: string; source: TrackSource; seq: number; points: TrackPoint[] };
export type ShownTrack = { source: TrackSource; points: TrackPoint[]; metrics: TrackMetrics };

export class Tracks {
  constructor(
    private readonly db: DB,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Stores a batch from `deviceId`; `stored: false` when that batch (track and seq) is already there. */
  async addBatch(deviceId: number, b: Batch): Promise<{ stored: boolean }> {
    return this.db.transaction().execute(async (tx) => {
      const walk = await findByKey(tx, b.walkKey, "walk");
      if (!walk) throw new InputError("Diese Runde gibt es nicht.");
      const at = this.now().toISOString();
      await tx.insertInto("track").values({ id: b.trackId, entry_id: walk.id, source: b.source, device_id: deviceId, created_at: at }).onConflict((oc) => oc.column("id").doNothing()).execute();
      const track = await tx.selectFrom("track").select("entry_id").where("id", "=", b.trackId).executeTakeFirstOrThrow();
      if (track.entry_id !== walk.id) throw new InputError("Diese Strecke gehört zu einer anderen Runde."); // a reused track id
      const r = await tx
        .insertInto("track_batch")
        .values({ track_id: b.trackId, seq: b.seq, points: JSON.stringify(b.points), received_at: at })
        .onConflict((oc) => oc.columns(["track_id", "seq"]).doNothing())
        .executeTakeFirst();
      return { stored: Number(r.numInsertedOrUpdatedRows ?? 0n) > 0 };
    });
  }

  /** The distance of the shown track of each walk in `entryIds` that has one (for the CSV). */
  async distances(entryIds: readonly number[]): Promise<Map<number, number>> {
    const out = new Map<number, number>();
    for (const id of entryIds) {
      const t = await this.forWalk(id);
      if (t) out.set(id, t.metrics.distanceM);
    }
    return out;
  }

  /** The track the walk shows, with its metrics and a simplified line for drawing; null without tracks. */
  async forWalk(entryId: number): Promise<ShownTrack | null> {
    const rows = await this.db
      .selectFrom("track")
      .innerJoin("track_batch", "track_batch.track_id", "track.id")
      .select(["track.id", "track.source", "track_batch.seq", "track_batch.points"])
      .where("track.entry_id", "=", entryId)
      .orderBy("track.id")
      .orderBy("track_batch.seq")
      .execute();
    const byTrack = new Map<string, { source: TrackSource; points: TrackPoint[] }>();
    for (const r of rows) {
      const t = byTrack.get(r.id) ?? { source: r.source === "watch" ? "watch" : "phone", points: [] };
      t.points.push(...(JSON.parse(r.points) as TrackPoint[]));
      byTrack.set(r.id, t);
    }
    const all = [...byTrack.values()].map((t) => ({ ...t, metrics: trackMetrics(t.points) }));
    const i = chooseTrack(all.map((t) => ({ source: t.source, distanceM: t.metrics.distanceM })));
    if (i === null) return null;
    return { source: all[i].source, points: simplify(all[i].points), metrics: all[i].metrics };
  }
}
