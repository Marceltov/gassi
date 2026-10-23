// How much food is left. Per kind (wet in closed cans, dry by weight) the count starts at the latest "stockcheck" (the
// stock counted by hand), else at the first restock ever entered (from 0), else it is unknown. Later restocks add. For
// dry food later feedings subtract, and so do treats that come out of it; for wet food each can opened ("opened")
// subtracts one can, and feedings don't: a feeding names no can, and an open can isn't counted. A count below zero
// shows as 0 and asks for a correction. "Reicht noch" divides what is left by the average daily grams fed of the last
// 14 days (of fewer while the count is younger than that).
//
// Wet food is counted per can size (400 g and 800 g cans are not merged), in whole cans, with a total over the sizes.
// A wet count sets every size at once: it is one stockcheck per size at the same time, and a size it leaves out is 0;
// a size it has no cans of is retired until it is bought, counted or opened again.
import type { Entry } from "./entry";
import type { FoodKind } from "./entryTypes";

export type KindStock = { grams: number | null; daysLeft: number | null; belowZero: boolean };
/** One can size: grams left in closed cans (never below 0), whole cans, whether it counts below 0, and when it was
 * last bought or counted with cans (null when neither). */
export type CanStock = { unitG: number; grams: number; cans: number; belowZero: boolean; lastAt: string | null };
/** `sizes`: every can size bought or counted, smallest first; `newestUnitG`: the size bought last. */
export type WetStock = KindStock & { sizes: CanStock[]; newestUnitG: number | null };
export type Stock = { wet: WetStock; dry: KindStock };
export type Treat = { at: string; grams: number };

/** Whole cans in `grams` of cans of `unitG` grams (an older count of 2,5 cans is 2 closed ones). */
export const cansOf = (grams: number, unitG: number): number => Math.max(0, Math.floor(grams / unitG));

const WINDOW_MS = 14 * 86_400_000;
const DAY_MS = 86_400_000;

const byTime = (a: Entry, b: Entry) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id - b.id);
const sum = (xs: readonly { amountG?: number | null; grams?: number }[]) => xs.reduce((s, x) => s + (x.grams ?? x.amountG ?? 0), 0);
type Use = { at: string; grams: number };

/** The average daily use since the count started (the last 14 days at most), and how long `left` lasts with it. */
function daysLeft(left: number, use: readonly Use[], countStart: string, now: number): number | null {
  const from = new Date(Math.max(now - WINDOW_MS, Date.parse(countStart))).toISOString();
  const used = sum(use.filter((u) => u.at >= from && u.at <= new Date(now).toISOString()));
  const coveredDays = Math.min(14, Math.max(1, (now - Date.parse(from)) / DAY_MS));
  return used > 0 ? Math.floor(left / (used / coveredDays)) : null;
}

function dryStock(entries: readonly Entry[], treats: readonly Treat[], now: number): KindStock {
  const sorted = [...entries].sort(byTime);
  const check = sorted.filter((e) => e.type === "stockcheck").at(-1);
  const firstRestock = sorted.find((e) => e.type === "restock");
  const start = check ?? firstRestock;
  if (!start) return { grams: null, daysLeft: null, belowZero: false };
  const use: Use[] = [...sorted.filter((e) => e.type === "food").map((e) => ({ at: e.at, grams: e.amountG ?? 0 })), ...treats];
  // after a check: what was there then, plus what came, minus what went; else everything from the first restock on
  const counts = (at: string) => (check ? at > check.at : at >= start.at);
  const grams = (check?.amountG ?? 0) + sum(sorted.filter((e) => e.type === "restock" && counts(e.at))) - sum(use.filter((u) => counts(u.at)));
  const left = Math.max(0, grams);
  return { grams: left, daysLeft: daysLeft(left, use, start.at, now), belowZero: grams < 0 };
}

function wetStock(entries: readonly Entry[], now: number): WetStock {
  const sorted = [...entries].sort(byTime);
  const restocks = sorted.filter((e) => e.type === "restock" && e.unitG);
  const opened = sorted.filter((e) => e.type === "opened" && e.unitG);
  const checkAt = sorted.filter((e) => e.type === "stockcheck").at(-1)?.at;
  const check = sorted.filter((e) => e.type === "stockcheck" && e.at === checkAt);
  // the known sizes (Ruling V): those the latest count has cans of, and those bought or opened after it; without a
  // count every size bought or opened. So a count that sets a size to 0 retires it, one opened down to 0 stays.
  const after = [...restocks, ...opened].filter((e) => (checkAt ? e.at > checkAt : true));
  const units = [...new Set([...check.filter((c) => (c.amountG ?? 0) > 0), ...after].flatMap((e) => (e.unitG ? [e.unitG] : [])))].sort((a, b) => a - b);
  const newestUnitG = restocks.at(-1)?.unitG ?? null;
  if (!units.length && !checkAt) return { grams: null, daysLeft: null, belowZero: false, sizes: [], newestUnitG };

  const sizes = units.map((unitG): CanStock => {
    const mine = (e: Entry) => e.unitG === unitG;
    // after a count: what it said for this size (0 when it left the size out); else from this size's first restock
    const from = checkAt ?? restocks.find(mine)?.at ?? "";
    const counts = (e: Entry) => mine(e) && (checkAt ? e.at > checkAt : e.at >= from);
    // whole closed cans: an older count of 2,5 cans counts 2
    const counted = check.filter(mine).reduce((g, c) => g + cansOf(c.amountG ?? 0, unitG) * unitG, 0);
    const grams = counted + sum(restocks.filter(counts)) - sum(opened.filter(counts));
    const left = Math.max(0, grams);
    const lastAt = [...restocks, ...check.filter((c) => (c.amountG ?? 0) > 0)].filter(mine).reduce<string | null>((t, e) => (t === null || e.at > t ? e.at : t), null);
    return { unitG, grams: left, cans: cansOf(left, unitG), belowZero: grams < 0, lastAt };
  });
  const left = sum(sizes);
  const countStart = checkAt ?? restocks[0]?.at ?? sorted[0]?.at ?? new Date(now).toISOString();
  const use = sorted.filter((e) => e.type === "food").map((e) => ({ at: e.at, grams: e.amountG ?? 0 }));
  return { grams: left, daysLeft: daysLeft(left, use, countStart, now), belowZero: sizes.some((s) => s.belowZero), sizes, newestUnitG };
}

/** `entries`: all entries (other types are ignored); `treats`: the treats that come out of the dry food. */
export function computeStock(input: { entries: readonly Entry[]; treats: readonly Treat[]; now: number }): Stock {
  const of = (kind: FoodKind) => input.entries.filter((e) => e.foodKind === kind && (e.type === "food" || e.type === "restock" || e.type === "stockcheck" || e.type === "opened"));
  return { wet: wetStock(of("wet"), input.now), dry: dryStock(of("dry"), input.treats, input.now) };
}
