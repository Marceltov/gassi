// The treats given from the dry food, read from the database for the stock count (computeStock is in the domain).
import type { Treat } from "@gassi/domain";
import type { DB } from "./db/open";

/** The treats given from the dry food: per training and kind, count × grams per piece (both as when given), at the
 * training's start. */
export async function dryTreats(db: DB): Promise<Treat[]> {
  const rows = await db
    .selectFrom("training_treat")
    .innerJoin("entry", "entry.id", "training_treat.entry_id")
    .select(["entry.at", "training_treat.count", "training_treat.grams_per_piece"])
    .where("training_treat.from_dry", "=", 1)
    .where("training_treat.count", ">", 0)
    .orderBy("entry.at")
    .execute();
  return rows.map((r) => ({ at: r.at, grams: r.count * r.grams_per_piece }));
}

