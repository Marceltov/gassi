// How much food is left. Per kind (wet in cans, dry by weight) the count starts at the latest "stockcheck" (the stock
// corrected by hand), else at the first restock ever entered (from 0), else it is unknown. Later restocks add, later
// feedings subtract, and for dry food so do treats that come out of it. A count below zero shows as 0 and asks for a
// correction. "Reicht noch" divides what is left by the average daily use of the last 14 days (of fewer while the
// count is younger than that).
//
// Wet food is counted per can size (400 g and 800 g cans are not merged), with a total over the sizes. A wet count
// sets every size at once: it is one stockcheck per size at the same time, and a size it leaves out is 0; a size
// it has no cans of is retired until it is bought, counted or fed again. A feeding
// names the can it came out of; one that doesn't (older data) comes out of the size bought most recently before it.
import type { Entry } from "./entry";
import type { FoodKind } from "./entryTypes";

export type KindStock = { grams: number | null; daysLeft: number | null; belowZero: boolean };
/** One can size: grams left (never below 0), cans (rounded down to ¼), and whether it counts below 0. */
export type CanStock = { unitG: number; grams: number; cans: number; belowZero: boolean };
/** `sizes`: every can size bought or counted, smallest first; `newestUnitG`: the size bought last. */
export type WetStock = KindStock & { sizes: CanStock[]; newestUnitG: number | null };
export type Stock = { wet: WetStock; dry: KindStock };
export type Treat = { at: string; grams: number };

/** Grams lost to rounding ½ Dose (395 g → 198 g) that must not take a half can away. */
const HALF_SLACK_G = 5;

/** What a feeding takes out of cans of `unitG` grams: ½ Dose (stored as whole grams, 395 g → 198 g) is exactly half a
 * can, so that many halves don't drift; anything else is its grams. */
export const canGrams = (grams: number, unitG: number): number => (grams === Math.round(unitG / 2) ? unitG / 2 : grams);

/** Cans in `grams` of cans of `unitG` grams, rounded down to quarters (Ruling W), give or take a few grams. */
export const cansOf = (grams: number, unitG: number): number => Math.max(0, Math.floor(((grams + HALF_SLACK_G) / unitG) * 4) / 4);

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
  const checkAt = sorted.filter((e) => e.type === "stockcheck").at(-1)?.at;
  const check = sorted.filter((e) => e.type === "stockcheck" && e.at === checkAt);
  // the size an entry came out of: its own, else the one bought most recently before it (else any bought, else counted)
  const fallback = restocks.at(-1)?.unitG ?? check.find((c) => c.unitG)?.unitG ?? null;
  const sizeOf = (e: Entry) => e.unitG ?? restocks.filter((r) => r.at <= e.at).at(-1)?.unitG ?? fallback;
  // the known sizes (Ruling V): those the latest count has cans of, and those bought, counted or fed after it; without a
  // count every size bought (or fed). So a count that sets a size to 0 retires it, one eaten down to 0 stays.
  const after = sorted.filter((e) => (checkAt ? e.at > checkAt : true) && (e.type === "restock" || (e.type === "food" && e.unitG)));
  const sizesOf = (es: readonly Entry[]) => es.flatMap((e) => (sizeOf(e) ? [sizeOf(e)!] : []));
  const units = [...new Set([...sizesOf(check.filter((c) => (c.amountG ?? 0) > 0)), ...sizesOf(after)])].sort((a, b) => a - b);
  const newestUnitG = restocks.at(-1)?.unitG ?? null;
  if (!units.length && !checkAt) return { grams: null, daysLeft: null, belowZero: false, sizes: [], newestUnitG };

  const feedings = sorted.filter((e) => e.type === "food");
  const sizes = units.map((unitG): CanStock => {
    const mine = (e: Entry) => sizeOf(e) === unitG;
    // after a count: what it said for this size (0 when it left the size out); else from this size's first restock
    const from = checkAt ?? restocks.find(mine)?.at ?? "";
    const counts = (e: Entry) => mine(e) && (checkAt ? e.at > checkAt : e.at >= from);
    const grams = sum(check.filter(mine)) + sum(restocks.filter(counts)) - feedings.filter(counts).reduce((g, e) => g + canGrams(e.amountG ?? 0, unitG), 0);
    const left = Math.max(0, grams);
    return { unitG, grams: left, cans: cansOf(left, unitG), belowZero: grams < 0 };
  });
  const left = sum(sizes);
  const countStart = checkAt ?? restocks[0]?.at ?? sorted[0]?.at ?? new Date(now).toISOString();
  const use = feedings.map((e) => ({ at: e.at, grams: e.amountG ?? 0 }));
  return { grams: left, daysLeft: daysLeft(left, use, countStart, now), belowZero: sizes.some((s) => s.belowZero), sizes, newestUnitG };
}

/** `entries`: all entries (other types are ignored); `treats`: the treats that come out of the dry food. */
export function computeStock(input: { entries: readonly Entry[]; treats: readonly Treat[]; now: number }): Stock {
  const of = (kind: FoodKind) => input.entries.filter((e) => e.foodKind === kind && (e.type === "food" || e.type === "restock" || e.type === "stockcheck"));
  return { wet: wetStock(of("wet"), input.now), dry: dryStock(of("dry"), input.treats, input.now) };
}
