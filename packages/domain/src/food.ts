// Food amounts in words and the food sheet's starting values, for the stock screen and the food sheet.
import { FOOD_MAX_G, FOOD_MIN_G } from "./commands";
import { FOOD_KINDS, FOOD_SHORT, type FoodKind } from "./entryTypes";
import { type CanStock, cansOf, type Stock } from "./stock";
import { utcToLocal } from "./time";

const QUARTERS = ["", "¼", "½", "¾"];
/** "11½", "2¾", "¼", "0": whole cans and quarters (the stock rounds down to quarters). */
const halves = (cans: number): string => {
  const whole = Math.floor(cans);
  const part = QUARTERS[Math.round((cans - whole) * 4)] ?? "";
  return `${whole === 0 && part ? "" : whole}${part}`;
};

/** "11½ Dosen", "2¾ Dosen", "1 Dose", "½ Dose". */
export const formatCans = (cans: number): string => `${halves(cans)} ${cans > 0 && cans <= 1 ? "Dose" : "Dosen"}`;

/** One can size's count: "3 × 400 g", "2¾ × 800 g". */
export const formatCanCount = (s: Pick<CanStock, "unitG" | "cans">): string => `${halves(s.cans)} × ${s.unitG} g`;

/** "4,4 kg" from 1 kg on, else "800 g". */
export const formatWeight = (grams: number): string =>
  grams >= 1000 ? `${(grams / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} kg` : `${Math.round(grams)} g`;

/** "0,5" or "0.5" → 0.5; empty or anything else → NaN. */
export const parseDecimal = (v: string): number => (v.trim() ? Number(v.trim().replace(",", ".")) : NaN);

export type Portion = { foodKind: FoodKind; amountG: number };
/** Each kind's last portion, and the can size the last wet feeding came out of (when it said). */
type LastFood = { wet: number | null; dry: number | null; wetUnitG?: number | null };

/** What the food sheet offers when nothing else is known (no feeding yet). */
export const DEFAULT_PORTION_G: Record<FoodKind, number> = { wet: 100, dry: 50 };

/** The grams to start a feeding of `kind` with: that kind's last portion, else the newest of it in `recent`
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

/** Shortcuts for the amount: the household's recent portions of this kind (newest first, no repeats), and for wet
 * food half a can and a whole can once the can size is known; at most four. */
export function quickPortions(recent: readonly Portion[], kind: FoodKind, canSizeG: number | null): { label: string; amountG: number }[] {
  const cans = kind === "wet" && canSizeG ? [{ label: "½ Dose", amountG: Math.round(canSizeG / 2) }, { label: "1 Dose", amountG: canSizeG }] : [];
  const grams = [...new Set(recent.filter((p) => p.foodKind === kind).map((p) => p.amountG))].filter((g) => !cans.some((c) => c.amountG === g));
  return [...grams.slice(0, 4 - cans.length).map((amountG) => ({ label: `${amountG} g`, amountG })), ...cans];
}

/** The can sizes a wet feeding can come out of (the known ones, smallest first; without the server's stock yet the
 * last used one), and the one to start with: the last used one while it is known, else the one bought last. */
export function canChoices(stock: Stock | null, last: LastFood | null): { sizes: number[]; preset: number | null } {
  const used = last?.wetUnitG ?? null;
  if (!stock) return { sizes: used ? [used] : [], preset: used };
  const sizes = stock.wet.sizes.map((s) => s.unitG);
  const preset = [used, stock.wet.newestUnitG, stock.wet.sizes.findLast((s) => s.cans > 0)?.unitG, sizes.at(-1)].find((u) => u != null && sizes.includes(u)) ?? null;
  return { sizes, preset };
}

/** The stock of a kind in parts: what is left ("3 × 400 g · 2 × 800 g", "1,2 kg"; null when it isn't known), for wet
 * food each can size that has some left ("3 × 400 g") and the total ("zusammen 2,8 kg"), for how long ("reicht etwa
 * 12 Tage"; null without use to go by or when it ran out), and whether it ran out (or counts below zero). */
export function stockParts(stock: Stock, kind: FoodKind): { left: string | null; sizes: string[]; total: string | null; lasts: string | null; empty: boolean } {
  const s = kind === "wet" ? stock.wet : stock.dry;
  if (s.grams === null) return { left: null, sizes: [], total: null, lasts: null, empty: false };
  const cans = kind === "wet" ? stock.wet.sizes.filter((c) => c.cans > 0) : [];
  // wet food has run out when no size has half a can left; one size counting below zero leaves the others
  const empty = kind === "wet" ? !cans.length : s.belowZero || s.grams === 0;
  const sizes = cans.map(formatCanCount);
  const left = kind === "dry" ? formatWeight(s.grams) : empty ? formatCans(0) : sizes.join(" · ");
  const total = kind === "wet" && !empty ? `zusammen ${formatWeight(s.grams)}` : null;
  const days = s.daysLeft === null ? null : Math.round(s.daysLeft);
  const lasts = s.daysLeft === null || empty ? null : s.daysLeft < 0.5 ? "reicht weniger als einen Tag" : `reicht etwa ${days} ${days === 1 ? "Tag" : "Tage"}`;
  return { left, sizes, total, lasts, empty };
}

/** The stock of a kind in one line: "Vorrat: noch 3 × 400 g · 2 × 800 g · reicht etwa 9 Tage", "Vorrat
 * aufgebraucht"; null when it isn't known. */
export function stockLine(stock: Stock, kind: FoodKind): string | null {
  const { left, lasts, empty } = stockParts(stock, kind);
  if (empty) return "Vorrat aufgebraucht";
  if (left === null) return null;
  return `Vorrat: noch ${left}${lasts ? ` · ${lasts}` : ""}`;
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

/** Cans per size from the stock screen's rows: rows of the same size (a new row typed with a known size) add up. */
export function mergeSizes(rows: readonly { unitG: number; cans: number }[]): { unitG: number; cans: number }[] {
  const by = new Map<number, number>();
  for (const r of rows) by.set(r.unitG, (by.get(r.unitG) ?? 0) + r.cans);
  return [...by].map(([unitG, cans]) => ({ unitG, cans }));
}
