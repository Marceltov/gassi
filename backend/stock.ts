// How much food is left. Per kind (wet in cans, dry by weight) the count starts at the latest "stockcheck" (the stock
// corrected by hand), else at the first restock ever entered (from 0), else it is unknown. Later restocks add, later
// feedings subtract, and for dry food so do treats that come out of it. A count below zero shows as 0 and asks for a
// correction. "Reicht noch" divides what is left by the average use of the last 14 days.
import type { FoodKind } from "../shared/entryTypes";
import type { DB } from "./db/open";
import type { Entry } from "./entries/model";

export type KindStock = { grams: number | null; daysLeft: number | null; belowZero: boolean };
export type Stock = { wet: KindStock & { cans: number | null; canSizeG: number | null }; dry: KindStock };
export type Treat = { at: string; grams: number };

const WINDOW_MS = 14 * 86_400_000;

function kindStock(entries: readonly Entry[], treats: readonly Treat[], now: number): KindStock {
  const sorted = [...entries].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id - b.id));
  const check = sorted.filter((e) => e.type === "stockcheck").at(-1);
  const firstRestock = sorted.find((e) => e.type === "restock");
  const use = [...sorted.filter((e) => e.type === "food").map((e) => ({ at: e.at, grams: e.amountG ?? 0 })), ...treats];
  const windowStart = new Date(now - WINDOW_MS).toISOString();
  const used = use.filter((u) => u.at >= windowStart && u.at <= new Date(now).toISOString()).reduce((sum, u) => sum + u.grams, 0);

  let grams: number;
  if (check) {
    // after the check: what was there then, plus what came, minus what went
    const after = (at: string) => at > check.at;
    grams = (check.amountG ?? 0) + sum(sorted.filter((e) => e.type === "restock" && after(e.at))) - sum(use.filter((u) => after(u.at)));
  } else if (firstRestock) {
    const from = (at: string) => at >= firstRestock.at;
    grams = sum(sorted.filter((e) => e.type === "restock" && from(e.at))) - sum(use.filter((u) => from(u.at)));
  } else {
    return { grams: null, daysLeft: null, belowZero: false };
  }
  const left = Math.max(0, grams);
  return { grams: left, daysLeft: used > 0 ? Math.floor(left / (used / 14)) : null, belowZero: grams < 0 };
}

const sum = (xs: readonly { amountG?: number | null; grams?: number }[]) => xs.reduce((s, x) => s + (x.grams ?? x.amountG ?? 0), 0);

/** `entries`: all entries (other types are ignored); `treats`: the treats that come out of the dry food. */
export function computeStock(input: { entries: readonly Entry[]; treats: readonly Treat[]; now: number }): Stock {
  const of = (kind: FoodKind) => input.entries.filter((e) => e.foodKind === kind && (e.type === "food" || e.type === "restock" || e.type === "stockcheck"));
  const wetEntries = of("wet");
  const wet = kindStock(wetEntries, [], input.now);
  const canSizeG = wetEntries.filter((e) => e.type === "restock" && e.unitG).sort((a, b) => (a.at < b.at ? -1 : 1)).at(-1)?.unitG ?? null;
  const cans = wet.grams === null || !canSizeG ? null : Math.floor((wet.grams / canSizeG) * 2) / 2;
  return { wet: { ...wet, cans, canSizeG }, dry: kindStock(of("dry"), input.treats, input.now) };
}

/** The treats given from the dry food: per training and kind, count × grams per piece, at the training's start. */
export async function dryTreats(db: DB): Promise<Treat[]> {
  const rows = await db
    .selectFrom("training_treat")
    .innerJoin("treat_kind", "treat_kind.id", "training_treat.treat_kind_id")
    .innerJoin("entry", "entry.id", "training_treat.entry_id")
    .select(["entry.at", "training_treat.count", "treat_kind.grams_per_piece"])
    .where("treat_kind.from_dry", "=", 1)
    .where("training_treat.count", ">", 0)
    .orderBy("entry.at")
    .execute();
  return rows.map((r) => ({ at: r.at, grams: r.count * r.grams_per_piece }));
}

