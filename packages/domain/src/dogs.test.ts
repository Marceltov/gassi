import { describe, expect, test } from "vitest";
import { checkDogs, dogRule } from "./dogs";

describe("which entries belong to which dogs", () => {
  test("pee needs exactly one dog", () => {
    expect(checkDogs("pee", [])).toBe("Für welchen Hund?");
    expect(checkDogs("pee", [1, 2])).toBe("Das geht nur für einen Hund.");
    expect(checkDogs("pee", [1])).toBeNull();
    expect(dogRule("weight")).toBe("one");
  });

  test("a walk takes one or more", () => {
    expect(checkDogs("walk", [])).toBe("Für welchen Hund?");
    expect(checkDogs("walk", [1, 2])).toBeNull();
    expect(dogRule("food")).toBe("some");
  });

  test("restock takes none", () => {
    expect(checkDogs("restock", [1])).toBe("Das gehört zu keinem Hund.");
    expect(checkDogs("restock", [])).toBeNull();
    expect(dogRule("note")).toBe("none");
  });

  test("the same dog twice counts once", () => {
    expect(checkDogs("pee", [3, 3])).toBeNull();
  });
});
