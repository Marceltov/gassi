import { expect, test } from "vitest";
import { qrSvg } from "./qr";

test("draws a QR code as an SVG that follows the theme's colours", async () => {
  const svg = await qrSvg("gassi://join?server=https%3A%2F%2Fgassi.example&token=abc");
  expect(svg.startsWith("<svg")).toBe(true);
  expect(svg).toContain('stroke="currentColor"');
  expect(svg).not.toContain("#000000");
});
