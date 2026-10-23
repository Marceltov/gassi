// The household's dogs. Archiving keeps a dog's past entries; archived dogs aren't offered for new ones.
import { z } from "zod";
import type { DB } from "./db/open";
import { InputError } from "./errors";

/** `marks`: the walk offers "Markiert" for this dog (#38). */
export type Dog = { id: number; name: string; color: string; archived: boolean; marks: boolean };
export type DogInput = { name: string; color: string; marks?: boolean };

const name = z.string().trim().min(1).max(30);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

function checked<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new InputError(message);
  return r.data;
}
const NAME = "Der Name muss 1 bis 30 Zeichen lang sein.";
const COLOR = "Die Farbe stimmt nicht.";

/** The colour a household's first dog gets. */
export const FIRST_DOG_COLOR = "#b8691a";

const COLUMNS = ["id", "name", "color", "archived", "marks"] as const;
const toDog = (r: { id: number; name: string; color: string; archived: number; marks: number }): Dog => ({ id: r.id, name: r.name, color: r.color, archived: r.archived === 1, marks: r.marks === 1 });

export class DogRepository {
  constructor(
    private readonly db: DB,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** By name; archived ones only with `withArchived`. */
  async list({ withArchived = false } = {}): Promise<Dog[]> {
    let q = this.db.selectFrom("dog").select(COLUMNS).orderBy("name");
    if (!withArchived) q = q.where("archived", "=", 0);
    return (await q.execute()).map(toDog);
  }

  async add(input: DogInput): Promise<Dog> {
    const row = await this.db
      .insertInto("dog")
      .values({ name: checked(name, input.name, NAME), color: checked(color, input.color, COLOR), marks: input.marks ? 1 : 0, created_at: this.now().toISOString() })
      .returning(COLUMNS)
      .executeTakeFirstOrThrow();
    return toDog(row);
  }

  async update(id: number, change: { name?: string; color?: string; archived?: boolean; marks?: boolean }): Promise<Dog | undefined> {
    // every walk, pee and feeding needs a dog to belong to
    if (change.archived) {
      const active = await this.activeIds();
      if (active.length === 1 && active[0] === id) throw new InputError("Mindestens ein Hund muss bleiben.");
    }
    const row = await this.db
      .updateTable("dog")
      .set({
        ...(change.name !== undefined ? { name: checked(name, change.name, NAME) } : {}),
        ...(change.color !== undefined ? { color: checked(color, change.color, COLOR) } : {}),
        ...(change.archived !== undefined ? { archived: change.archived ? 1 : 0 } : {}),
        ...(change.marks !== undefined ? { marks: change.marks ? 1 : 0 } : {}),
      })
      .where("id", "=", id)
      .returning(COLUMNS)
      .executeTakeFirst();
    return row && toDog(row);
  }

  /** The ids of the dogs new walks and trainings take when none are named: all that aren't archived. */
  async activeIds(): Promise<number[]> {
    return (await this.list()).map((d) => d.id);
  }
}

/** A household that has no dog yet (the first OIDC sign-in sets it up) gets one: `name` (DOG_NAME), else "Mein Hund".
 * Returns it, or null when there is a dog already. */
export async function ensureFirstDog(db: DB, name: string | null, now: () => Date): Promise<Dog | null> {
  const any = await db.selectFrom("dog").select("id").limit(1).executeTakeFirst();
  return any ? null : new DogRepository(db, now).add({ name: name ?? "Mein Hund", color: FIRST_DOG_COLOR });
}
