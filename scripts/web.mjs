// Copies the Expo web export (apps/mobile/dist, from `npm run export -w @gassi/mobile`) into apps/server/public, where
// Next serves it; the fallback rewrite in next.config.ts answers every other path with its index.html.
// public/ also holds the server's own files (the icons, tracked in git): a copy never overwrites them. What the last
// copy put there is listed in public/.web-export and removed first, so old hashed bundles don't pile up.
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../apps/mobile/dist/", import.meta.url));
const pub = fileURLToPath(new URL("../apps/server/public/", import.meta.url));
const manifest = `${pub}.web-export`;

if (!existsSync(`${dist}index.html`)) throw new Error(`No web export in ${dist}: run npm run export -w @gassi/mobile first.`);
const previous = existsSync(manifest) ? readFileSync(manifest, "utf8").split("\n").filter(Boolean) : [];
for (const name of previous) rmSync(pub + name, { recursive: true, force: true });

const names = readdirSync(dist);
const clash = names.filter((name) => existsSync(pub + name));
if (clash.length) throw new Error(`The web export would overwrite the server's own public files: ${clash.join(", ")}`);
for (const name of names) cpSync(dist + name, pub + name, { recursive: true });
writeFileSync(manifest, `${names.join("\n")}\n`);
console.log(`Copied the web app into apps/server/public: ${names.join(", ")}`);
