// Renders the app icons from public/icon.svg (run after changing it: npm run icons, then commit the PNGs).
// The maskable icon keeps the paw inside the safe zone (the inner 80%) on a full-bleed background.
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile("public/icon.svg");
const BACKGROUND = "#2f6b45";

const render = (size) => sharp(svg, { density: 384 }).resize(size, size);

await render(192).png().toFile("public/icon-192.png");
await render(512).png().toFile("public/icon-512.png");
await render(180).flatten({ background: BACKGROUND }).png().toFile("public/apple-icon.png");

const inner = await render(400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: BACKGROUND } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile("public/icon-maskable-512.png");

console.log("icons written to public/");
