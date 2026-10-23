// Food amounts in words and the food sheet's starting values, for the stock screen and the food sheet.
import { FOOD_MAX_G, FOOD_MIN_G } from "./commands";
import { FOOD_KINDS, FOOD_SHORT, type FoodKind } from "./entryTypes";
import { type CanStock, cansOf, type Stock } from "./stock";
import { utcToLocal } from "./time";

/** "11 Dosen", "1 Dose", "0 Dosen": closed cans are whole. */
export const formatCans = (cans: number): string => `${cans} ${cans === 1 ? "Dose" : "Dosen"}`;

/** One can size's count: "3 × 400 g". */
export const formatCanCount = (s: Pick<CanStock, "unitG" | "cans">): string => `${s.cans} × ${s.unitG} g`;

/** "4,4 kg" from 1 kg on, else "800 g". */
export const formatWeight = (grams: number): string =>
  grams >= 1000 ? `${(grams / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} kg` : `${Math.round(grams)} g`;

/** "0,5" or "0.5" → 0.5; empty or anything else → NaN. */
export const parseDecimal = (v: string): number => (v.trim() ? Number(v.trim().replace(",", ".")) : NaN);

export type Portion = { foodKind: FoodKind; amountG: number };
/** Each kind's last portion, and the can size the last wet feeding came out of (when it said). */
type LastFood = { wet: number | null; dry: number | null };

/** What the food sheet offers when nothing else is known (no feeding yet). */
export const DEFAULT_PORTION_G: Record<FoodKind, number> = { wet: 100, dry: 50 };

/** The grams per dog to start a feeding of `kind` with: that kind's last portion, else the newest of it in `recent`
 * (newest first), else a default. */
export function portionFor(kind: FoodKind, recent: readonly Portion[], last: LastFood | null): number {
  return clampPortion(last?.[kind] ?? recent.find((p) => p.foodKind === kind)?.amountG ?? DEFAULT_PORTION_G[kind]);
}

/** Grams a feeding may have: a whole number from 1 to 5000. */
export const clampPortion = (grams: number): number => Math.min(FOOD_MAX_G, Math.max(FOOD_MIN_G, Math.round(grams)));

/** Kind and grams the sheet starts with: the newest feeding decides the kind, its kind's last portion the grams. */
export function prefillFood(recent: readonly Portion[], last: LastFood | null): Portion {
  const foodKind: FoodKind = recent[0]?.foodKind ?? (last?.wet == null && last?.dry != null ? "dry" : "wet");
  return { foodKind, amountG: portionFor(foodKind, recent, last) };
}

/** Shortcuts for the amount: the household's recent portions of this kind (newest first, no repeats), at most four. */
export function quickPortions(recent: readonly Portion[], kind: FoodKind): { label: string; amountG: number }[] {
  return [...new Set(recent.filter((p) => p.foodKind === kind).map((p) => p.amountG))].slice(0, 4).map((amountG) => ({ label: `${amountG} g`, amountG }));
}

/** A feeding's grams for each of its dogs (a feeding is stored as what all of them got together). */
export const perDog = (amountG: number, dogs: number): number => Math.round(amountG / Math.max(1, dogs));

/** The sizes a can is opened from, with their closed cans: those with cans left (smallest first); with none left,
 * every known size, so a can beyond the count can still be opened (the count then goes below zero). */
export function openableSizes(stock: Stock): { unitG: number; cans: number }[] {
  const all = stock.wet.sizes.map((s) => ({ unitG: s.unitG, cans: s.cans }));
  const left = all.filter((s) => s.cans > 0);
  return left.length ? left : all;
}

/** The stock of a kind in parts: what is left ("3 × 400 g · 2 × 800 g", "1,2 kg"; null when it isn't known), for wet
 * food each can size that has some left ("3 × 400 g"), the amount ("2,8 kg"; null when it isn't known), for how long
 * ("reicht etwa 12 Tage"; null without use to go by or when it ran out), and whether it ran out (or counts below zero). */
export function stockParts(stock: Stock, kind: FoodKind): { left: string | null; sizes: string[]; amount: string | null; lasts: string | null; empty: boolean } {
  const s = kind === "wet" ? stock.wet : stock.dry;
  if (s.grams === null) return { left: null, sizes: [], amount: null, lasts: null, empty: false };
  const cans = kind === "wet" ? stock.wet.sizes.filter((c) => c.cans > 0) : [];
  // wet food has run out when no size has half a can left; one size counting below zero leaves the others
  const empty = kind === "wet" ? !cans.length : s.belowZero || s.grams === 0;
  const sizes = cans.map(formatCanCount);
  const left = kind === "dry" ? formatWeight(s.grams) : empty ? formatCans(0) : sizes.join(" · ");
  const amount = formatWeight(Math.max(0, s.grams));
  const days = s.daysLeft === null ? null : Math.round(s.daysLeft);
  const lasts = s.daysLeft === null || empty ? null : s.daysLeft < 0.5 ? "reicht weniger als einen Tag" : `reicht etwa ${days} ${days === 1 ? "Tag" : "Tage"}`;
  return { left, sizes, amount, lasts, empty };
}

/** Both kinds' stock in one line, the same form for each: "Nass: 3 × 400 g, 2 × 800 g · Trocken: 1,2 kg", "Nass:
 * aufgebraucht"; a kind never entered stays out; null when neither is known. */
export function stockSummary(stock: Stock): string | null {
  const parts = FOOD_KINDS.flatMap((k) => {
    const { left, sizes, empty } = stockParts(stock, k);
    return empty ? [`${FOOD_SHORT[k]}: aufgebraucht`] : left ? [`${FOOD_SHORT[k]}: ${sizes.length ? sizes.join(", ") : left}`] : [];
  });
  return parts.length ? parts.join(" · ") : null;
}

/** A wet count (its rows: grams per can size) in one line: "3 × 400 g, 1 × 800 g". */
export const countLine = (rows: readonly { unitG: number; amountG: number }[]): string => rows.map((r) => formatCanCount({ unitG: r.unitG, cans: cansOf(r.amountG, r.unitG) })).join(", ");

/** "Zählung vom 20.10., 10:05": a wet count, named by its time in `timeZone`. */
export function countTitle(at: string, timeZone: string): string {
  const local = utcToLocal(Date.parse(at), timeZone); // "2026-10-20T10:05"
  return `Zählung vom ${local.slice(8, 10)}.${local.slice(5, 7)}., ${local.slice(11)}`;
}

/** What a wet count comes to ("2,8 kg"): its cans per size as typed ("3"); null while one isn't a number. */
export function countWeight(sizes: readonly { unitG: number; cans: string }[]): string | null {
  const cans = sizes.map((s) => parseDecimal(s.cans));
  return cans.some((n) => !Number.isFinite(n) || n < 0) ? null : formatWeight(sizes.reduce((g, s, i) => g + s.unitG * cans[i]!, 0));
}

/** Cans per size from the stock screen's rows: rows of the same size (a new row typed with a known size) add up. */
export function mergeSizes(rows: readonly { unitG: number; cans: number }[]): { unitG: number; cans: number }[] {
  const by = new Map<number, number>();
  for (const r of rows) by.set(r.unitG, (by.get(r.unitG) ?? 0) + r.cans);
  return [...by].map(([unitG, cans]) => ({ unitG, cans }));
}

/** A can size typed in: whole grams from 1 to 10000 ("400", " 400 "), else null. */
export const parseCanSize = (v: string): number | null => (/^\d{1,5}$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 10_000 ? Number(v) : null);

/** What the stock screen's rows send (Ruling X): each row by its size as it now reads, its count as typed. Counting,
 * a known size that is in no row any more is 0 (retired), so correcting "10000" to "1000" retires 10000 g; buying, an
 * edited size only changes what is bought. Rows without a valid size are left out and counted in `unsized`. */
export function formSizes<C extends string | number>(known: readonly number[], rows: readonly { size: string; cans: C }[], counting: boolean): { sizes: { unitG: number; cans: C | "0" }[]; unsized: number } {
  const sized = rows.flatMap((r) => {
    const unitG = parseCanSize(r.size);
    return unitG ? [{ unitG, cans: r.cans as C | "0" }] : [];
  });
  const gone = counting ? known.filter((u) => !sized.some((s) => s.unitG === u)).map((unitG) => ({ unitG, cans: "0" as const })) : [];
  return { sizes: [...sized, ...gone], unsized: rows.length - sized.length };
}

/** A can size hidden from the purchase rows on this phone (Ruling Z), with its `lastAt` from the stock at the tap: the
 * server's time, so the phone's clock doesn't matter. */
export type HiddenSize = { unitG: number; seenLastAt: string | null };

/** The hidden sizes that stay hidden: one comes back once it has been bought or counted with cans since it was hidden
 * (its `lastAt` is no longer the one seen then). */
export function stillHidden(stock: Stock, hidden: readonly HiddenSize[]): HiddenSize[] {
  return hidden.filter((h) => (stock.wet.sizes.find((s) => s.unitG === h.unitG)?.lastAt ?? null) === h.seenLastAt);
}

/** The can sizes the purchase rows offer: the known ones without those hidden on this phone. */
export const buyingSizes = (stock: Stock, hidden: readonly HiddenSize[]): number[] => {
  const keep = stillHidden(stock, hidden);
  return stock.wet.sizes.map((s) => s.unitG).filter((u) => !keep.some((h) => h.unitG === u));
};
