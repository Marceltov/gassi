// The household's own lists: the exercises it trains and the kinds of treats it gives. Removing one archives it, so
// past trainings keep their names; adding an archived name again brings it back. A treat kind with `training` off stays
// at home: the training doesn't offer it (#126).
import { z } from "zod";
import type { DB } from "./db/open";
import { InputError } from "./errors";

export type Exercise = { id: number; name: string };
export type TreatKind = { id: number; name: string; gramsPerPiece: number; fromDry: boolean; training: boolean };
export type TreatKindInput = { name: string; gramsPerPiece: number; fromDry: boolean; training: boolean };

const nameSchema = z.string().trim().min(1).max(40);
const treatSchema = z.object({
  name: nameSchema,
  gramsPerPiece: z.coerce.number().min(0.1).max(100),
  fromDry: z.boolean(),
  training: z.boolean(),
});

function name(raw: unknown): string {
  const r = nameSchema.safeParse(raw);
  if (!r.success) throw new InputError("Der Name muss 1 bis 40 Zeichen lang sein.");
  return r.data;
}

function treat(raw: unknown): TreatKindInput {
  const r = treatSchema.safeParse(raw);
  if (r.success) return r.data;
  const field = r.error.issues[0]?.path[0];
  throw new InputError(field === "gramsPerPiece" ? "Ein Stück wiegt 0,1 bis 100 g." : "Der Name muss 1 bis 40 Zeichen lang sein.");
}

const isUniqueViolation = (e: unknown) => e instanceof Error && /UNIQUE constraint failed/.test(e.message);

async function unique<T>(message: string, act: () => Promise<T>): Promise<T> {
  try {
    return await act();
  } catch (e) {
    if (isUniqueViolation(e)) throw new InputError(message);
    throw e;
  }
}

const DUPLICATE_EXERCISE = "Diese Übung gibt es schon.";
const DUPLICATE_TREAT = "Dieses Leckerli gibt es schon.";

export class Catalog {
  constructor(private readonly db: DB) {}

  async exercises(): Promise<Exercise[]> {
    return this.db.selectFrom("exercise").select(["id", "name"]).where("archived", "=", 0).orderBy("name").execute();
  }

  async addExercise(raw: unknown): Promise<Exercise> {
    const n = name(raw);
    const old = await this.db.selectFrom("exercise").select(["id", "name", "archived"]).where("name", "=", n).executeTakeFirst();
    if (old && !old.archived) throw new InputError(DUPLICATE_EXERCISE);
    if (old) {
      await this.db.updateTable("exercise").set({ archived: 0 }).where("id", "=", old.id).execute();
      return { id: old.id, name: old.name };
    }
    return this.db.insertInto("exercise").values({ name: n }).returning(["id", "name"]).executeTakeFirstOrThrow();
  }

  async renameExercise(id: number, raw: unknown): Promise<void> {
    const n = name(raw);
    await unique(DUPLICATE_EXERCISE, () => this.db.updateTable("exercise").set({ name: n }).where("id", "=", id).execute());
  }

  async archiveExercise(id: number): Promise<void> {
    await this.db.updateTable("exercise").set({ archived: 1 }).where("id", "=", id).execute();
  }

  async treatKinds(): Promise<TreatKind[]> {
    const rows = await this.db.selectFrom("treat_kind").select(["id", "name", "grams_per_piece", "from_dry", "training"]).where("archived", "=", 0).orderBy("name").execute();
    return rows.map((r) => ({ id: r.id, name: r.name, gramsPerPiece: r.grams_per_piece, fromDry: r.from_dry === 1, training: r.training === 1 }));
  }

  async addTreatKind(raw: unknown): Promise<TreatKind> {
    const t = treat(raw);
    const columns = { grams_per_piece: t.gramsPerPiece, from_dry: t.fromDry ? 1 : 0, training: t.training ? 1 : 0 };
    const old = await this.db.selectFrom("treat_kind").select(["id", "archived"]).where("name", "=", t.name).executeTakeFirst();
    if (old && !old.archived) throw new InputError(DUPLICATE_TREAT);
    if (old) await this.db.updateTable("treat_kind").set({ ...columns, archived: 0 }).where("id", "=", old.id).execute();
    const id = old?.id ?? (await this.db.insertInto("treat_kind").values({ name: t.name, ...columns }).returning("id").executeTakeFirstOrThrow()).id;
    return { id, ...t };
  }

  async updateTreatKind(id: number, raw: unknown): Promise<void> {
    const t = treat(raw);
    await unique(DUPLICATE_TREAT, () =>
      this.db.updateTable("treat_kind").set({ name: t.name, grams_per_piece: t.gramsPerPiece, from_dry: t.fromDry ? 1 : 0, training: t.training ? 1 : 0 }).where("id", "=", id).execute(),
    );
  }

  async archiveTreatKind(id: number): Promise<void> {
    await this.db.updateTable("treat_kind").set({ archived: 1 }).where("id", "=", id).execute();
  }
}
