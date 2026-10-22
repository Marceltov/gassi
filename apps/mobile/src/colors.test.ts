import { describe, expect, it } from "vitest";
import { contrast, danger, gradients, kinds, onColor, WHITE } from "./colors";

describe("white text on the kind colors", () => {
  for (const [kind, [light, dark]] of Object.entries(gradients)) {
    it(`${kind}: both gradient ends have 4.5:1`, () => {
      expect(contrast(WHITE, light)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(WHITE, dark)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${kind}: the gradient stays visible`, () => {
      expect(contrast(light, dark)).toBeGreaterThanOrEqual(1.4);
    });
  }
  for (const [kind, color] of Object.entries(kinds)) {
    it(`${kind}: the flat color has 4.5:1`, () => {
      expect(contrast(WHITE, color)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("food stays distinct from poop", () => {
    expect(contrast(kinds.food, kinds.poop)).toBeGreaterThan(1.4);
  });
});

describe("danger", () => {
  // the page and the card of each theme (theme.ts)
  const grounds = { dark: ["#111418", "#1c2026"], light: ["#f3f4f6", "#ffffff"] } as const;
  for (const scheme of ["dark", "light"] as const)
    it(`${scheme}: reads as text on the page and on a card`, () => {
      for (const ground of grounds[scheme]) expect(contrast(danger[scheme], ground)).toBeGreaterThanOrEqual(4.5);
    });
});

describe("onColor", () => {
  it("is white on dark colors", () => {
    expect(onColor("#000000")).toBe("#ffffff");
    expect(onColor("#2e7d4f")).toBe("#ffffff");
  });
  it("is a dark ink on light colors", () => {
    expect(onColor("#ffffff")).not.toBe("#ffffff");
    expect(onColor("#f5d142")).not.toBe("#ffffff");
  });
  it("keeps icon contrast (3:1) on the dog colors on offer", () => {
    for (const c of ["#b8691a", "#8a5a1f", "#2e7d4f", "#3b5ba5", "#7a5ab8", "#a33b5b", "#b08a16", "#5f6670", "#ffe066", "#7ee0a0"]) {
      expect(contrast(c, onColor(c))).toBeGreaterThanOrEqual(3);
    }
  });
});
