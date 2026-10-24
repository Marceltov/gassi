// A training's repetitions per exercise and dog are three count columns, one per grade (klappt, geht so, klappt nicht;
// #100): how they are selected and read.
import { type Counts, type Grade } from "@gassi/domain";

export const COUNT_COLUMNS = ["ok_count", "meh_count", "fail_count"] as const;
export const COUNT_COLUMN: Record<Grade, (typeof COUNT_COLUMNS)[number]> = { ok: "ok_count", meh: "meh_count", fail: "fail_count" };
type Row = Record<(typeof COUNT_COLUMNS)[number], number>;

export const countsOf = (r: Row): Counts => ({ ok: r.ok_count, meh: r.meh_count, fail: r.fail_count });
export const countRow = (c: Counts): Row => ({ ok_count: c.ok, meh_count: c.meh, fail_count: c.fail });
