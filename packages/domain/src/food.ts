// Food amounts in words and the food sheet's starting values, for the stock screen and the food sheet.
import { FOOD_MAX_G, FOOD_MIN_G } from "./commands";
import type { FoodKind } from "./entryTypes";
import type { Stock } from "./stock";

/** "11½ Dosen", "1 Dose", "½ Dose". */
export function formatCans(cans: number): string {
  const whole = Math.floor(cans);
  const text = `${whole === 0 && cans % 1 ? "" : whole}${cans % 1 ? "½" : ""}`;
  return `${text} ${cans > 0 && cans <= 1 ? "Dose" : "Dosen"}`;
}

/** "4,4 kg" from 1 kg on, else "800 g". */
export const formatWeight = (grams: number): string =>
  grams >= 1000 ? `${(grams / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} kg` : `${Math.round(grams)} g`;

/** "0,5" or "0.5" → 0.5; empty or anything else → NaN. */
export const parseDecimal = (v: string): number => (v.trim() ? Number(v.trim().replace(",", ".")) : NaN);

export type Portion = { foodKind: FoodKind; amountG: number };
type LastFood = { wet: number | null; dry: number | null };

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

/** The stock of a kind in one line: "Vorrat: noch 9 Dosen · reicht etwa 12 Tage", "Vorrat aufgebraucht"; null when
 * it isn't known. */
export function stockLine(stock: Stock, kind: FoodKind): string | null {
  const s = kind === "wet" ? stock.wet : { ...stock.dry, cans: null };
  const amount = s.cans ?? s.grams;
  if (s.belowZero || amount === 0) return "Vorrat aufgebraucht";
  if (amount === null) return null;
  const left = s.cans !== null ? formatCans(s.cans) : formatWeight(s.grams ?? 0);
  const days = s.daysLeft === null ? null : Math.round(s.daysLeft);
  const lasts = s.daysLeft === null ? "" : s.daysLeft < 0.5 ? " · reicht weniger als einen Tag" : ` · reicht etwa ${days} ${days === 1 ? "Tag" : "Tage"}`;
  return `Vorrat: noch ${left}${lasts}`;
}
