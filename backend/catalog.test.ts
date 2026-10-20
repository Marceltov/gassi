import { describe, expect, test } from "vitest";
import { Catalog } from "./catalog";
import { freshDatabase } from "./db/testing";
import { InputError } from "./errors";

const { db } = freshDatabase();
const catalog = () => new Catalog(db());

describe("exercises", () => {
  test("are added trimmed, renamed and listed by name", async () => {
    const c = catalog();
    const sitz = await c.addExercise("  Sitz ");
    await c.addExercise("Bleib");
    expect(sitz).toEqual({ id: sitz.id, name: "Sitz" });
    await c.renameExercise(sitz.id, "Rückruf");
    expect((await c.exercises()).map((e) => e.name)).toEqual(["Bleib", "Rückruf"]);
  });

  test("a duplicate name is refused", async () => {
    await catalog().addExercise("Sitz");
    await expect(catalog().addExercise("Sitz")).rejects.toThrow(new InputError("Diese Übung gibt es schon."));
    const bleib = await catalog().addExercise("Bleib");
    await expect(catalog().renameExercise(bleib.id, "Sitz")).rejects.toThrow(new InputError("Diese Übung gibt es schon."));
  });

  test("an empty or too long name is refused", async () => {
    await expect(catalog().addExercise("  ")).rejects.toThrow(InputError);
    await expect(catalog().addExercise("x".repeat(41))).rejects.toThrow(InputError);
  });

  test("archived ones are hidden, and adding the name again brings the same one back", async () => {
    const c = catalog();
    const sitz = await c.addExercise("Sitz");
    await c.archiveExercise(sitz.id);
    expect(await c.exercises()).toEqual([]);
    expect(await c.addExercise("Sitz")).toEqual(sitz);
    expect(await c.exercises()).toEqual([sitz]);
  });
});

describe("treat kinds", () => {
  test("are added with grams per piece and whether they come out of the dry food", async () => {
    const c = catalog();
    const k = await c.addTreatKind({ name: "Trockenfutter-Stück", gramsPerPiece: 0.5, fromDry: true });
    expect(k).toEqual({ id: k.id, name: "Trockenfutter-Stück", gramsPerPiece: 0.5, fromDry: true });
    await c.updateTreatKind(k.id, { name: "Käsewürfel", gramsPerPiece: 2, fromDry: false });
    expect(await c.treatKinds()).toEqual([{ id: k.id, name: "Käsewürfel", gramsPerPiece: 2, fromDry: false }]);
  });

  test("grams per piece stay between 0.1 and 100", async () => {
    await expect(catalog().addTreatKind({ name: "Staub", gramsPerPiece: 0.05, fromDry: true })).rejects.toThrow(new InputError("Ein Stück wiegt 0,1 bis 100 g."));
    await expect(catalog().addTreatKind({ name: "Knochen", gramsPerPiece: 101, fromDry: false })).rejects.toThrow(InputError);
  });

  test("a duplicate name is refused, an archived one comes back", async () => {
    const c = catalog();
    const k = await c.addTreatKind({ name: "Käse", gramsPerPiece: 1, fromDry: false });
    await expect(c.addTreatKind({ name: "Käse", gramsPerPiece: 1, fromDry: false })).rejects.toThrow(new InputError("Dieses Leckerli gibt es schon."));
    await c.archiveTreatKind(k.id);
    expect(await c.treatKinds()).toEqual([]);
    expect(await c.addTreatKind({ name: "Käse", gramsPerPiece: 3, fromDry: false })).toEqual({ ...k, gramsPerPiece: 3 });
  });
});
