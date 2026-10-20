// v1 has one dog: the first one, created on first start (db/open.ts).
import type { DB } from "./db/open";

export type Dog = { id: number; name: string };

export async function currentDog(db: DB): Promise<Dog> {
  return db.selectFrom("dog").select(["id", "name"]).orderBy("id").limit(1).executeTakeFirstOrThrow();
}
