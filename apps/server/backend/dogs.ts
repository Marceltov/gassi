// The household's dogs. Archiving keeps a dog's past entries; archived dogs aren't offered for new ones.
import { z } from "zod";
import type { DB } from "./db/open";
import { InputError } from "./errors";

export type Dog = { id: number; name: string; color: string; archived: boolean };
export type DogInput = { name: string; color: string };

const name = z.string().trim().min(1).max(30);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

function checked<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new InputError(message);
  return r.data;
}
const NAME = "Der Name muss 1 bis 30 Zeichen lang sein.";
const COLOR = "Die Farbe stimmt nicht.";

const toDog = (r: { id: number; name: string; color: string; archived: number }): Dog => ({ id: r.id, name: r.name, color: r.color, archived: r.archived === 1 });

export class DogRepository {
  constructor(
    private readonly db: DB,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** By name; archived ones only with `withArchived`. */
  async list({ withArchived = false } = {}): Promise<Dog[]> {
    let q = this.db.selectFrom("dog").select(["id", "name", "color", "archived"]).orderBy("name");
    if (!withArchived) q = q.where("archived", "=", 0);
    return (await q.execute()).map(toDog);
  }

  async add(input: DogInput): Promise<Dog> {
    const row = await this.db
      .insertInto("dog")
      .values({ name: checked(name, input.name, NAME), color: checked(color, input.color, COLOR), created_at: this.now().toISOString() })
      .returning(["id", "name", "color", "archived"])
      .executeTakeFirstOrThrow();
    return toDog(row);
  }

  async update(id: number, change: { name?: string; color?: string; archived?: boolean }): Promise<Dog | undefined> {
    const row = await this.db
      .updateTable("dog")
      .set({
        ...(change.name !== undefined ? { name: checked(name, change.name, NAME) } : {}),
        ...(change.color !== undefined ? { color: checked(color, change.color, COLOR) } : {}),
        ...(change.archived !== undefined ? { archived: change.archived ? 1 : 0 } : {}),
      })
      .where("id", "=", id)
      .returning(["id", "name", "color", "archived"])
      .executeTakeFirst();
    return row && toDog(row);
  }

  /** The ids of the dogs new walks and trainings take when none are named: all that aren't archived. */
  async activeIds(): Promise<number[]> {
    return (await this.list()).map((d) => d.id);
  }
}
