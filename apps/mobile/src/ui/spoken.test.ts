import { expect, test } from "vitest";
import { spoken } from "./spoken";

test("a label is read without its signs", () => {
  expect(spoken("🐕 Gassi gehen")).toBe("Gassi gehen");
  expect(spoken("⏸ Pause")).toBe("Pause");
  expect(spoken("✓ Fertig")).toBe("Fertig");
  expect(spoken("⚖️ Gewicht")).toBe("Gewicht");
  expect(spoken("Runde läuft · 12:03")).toBe("Runde läuft · 12:03");
});
