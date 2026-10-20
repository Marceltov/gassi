import { describe, expect, test } from "vitest";
import { Catalog } from "./catalog";
import { freshDatabase } from "./db/testing";
import { Sessions } from "./sessions";
import { dryTreats } from "./stock";

const NOW = Date.parse("2026-10-20T12:00:00Z");

describe("dryTreats", () => {
  const { db } = freshDatabase();
  test("only treats that come out of the dry food, as grams at the training's time", async () => {
    const c = new Catalog(db());
    const dry = await c.addTreatKind({ name: "Trockenfutter-Stück", gramsPerPiece: 0.5, fromDry: true });
    const cheese = await c.addTreatKind({ name: "Käse", gramsPerPiece: 2, fromDry: false });
    const s = new Sessions({ db: db(), dog: { id: 1, name: "Toffee" }, names: new Map(), now: () => new Date(NOW) });
    await s.apply({ username: "bille", name: "Herzii" }, [
      { id: "1", at: "2026-10-20T09:00:00.000Z", kind: "training.start", trainingKey: "t" },
      ...[1, 2, 3, 4].map((n) => ({ id: `d${n}`, at: `2026-10-20T09:0${n}:00.000Z`, kind: "training.treat" as const, trainingKey: "t", treatKindId: dry.id, delta: 1 as const })),
      { id: "c", at: "2026-10-20T09:05:00.000Z", kind: "training.treat", trainingKey: "t", treatKindId: cheese.id, delta: 1 },
    ]);
    expect(await dryTreats(db())).toEqual([{ at: "2026-10-20T09:00:00.000Z", grams: 2 }]);
  });

  test("changing a treat kind later doesn't change what past treats weighed or where they came from", async () => {
    const c = new Catalog(db());
    const dry = await c.addTreatKind({ name: "Stück", gramsPerPiece: 0.5, fromDry: true });
    const s = new Sessions({ db: db(), dog: { id: 1, name: "Toffee" }, names: new Map(), now: () => new Date(NOW) });
    const treat = (id: string, minute: number) => ({ id, at: `2026-10-20T09:0${minute}:00.000Z`, kind: "training.treat" as const, trainingKey: "t", treatKindId: dry.id, delta: 1 as const });
    await s.apply({ username: "bille", name: "Herzii" }, [{ id: "1", at: "2026-10-20T09:00:00.000Z", kind: "training.start", trainingKey: "t" }, treat("a", 1), treat("b", 2)]);
    await c.updateTreatKind(dry.id, { name: "Stück", gramsPerPiece: 3, fromDry: true });
    expect(await dryTreats(db())).toEqual([{ at: "2026-10-20T09:00:00.000Z", grams: 1 }]);
    await c.updateTreatKind(dry.id, { name: "Stück", gramsPerPiece: 3, fromDry: false });
    expect(await dryTreats(db())).toEqual([{ at: "2026-10-20T09:00:00.000Z", grams: 1 }]);
  });
});
