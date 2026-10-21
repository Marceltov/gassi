// Exports the Expo web app (apps/mobile) and copies the export into apps/server/public, where Next serves it; the
// fallback rewrite in next.config.ts answers every other path with its index.html.
// The export (about a minute) is skipped when nothing it depends on changed since the last one: a hash over the app's
// sources, the two packages it imports, the lockfile and the EXPO_PUBLIC_* variables is kept in apps/mobile/dist/.stamp.
// `--force` exports anyway. The copy always runs (it is fast), so a cleaned public/ is refilled.
// public/ also holds the server's own files (the icons, tracked in git): a copy never overwrites them. What the last
// copy put there is listed in public/.web-export and removed first, so old hashed bundles don't pile up.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exportStamp, needsExport } from "./web-stamp.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = `${root}apps/mobile/dist/`;
const pub = `${root}apps/server/public/`;
const manifest = `${pub}.web-export`;
const stampFile = `${dist}.stamp`;

/** Every file the export depends on, with a hash of its content (not its mtime: a checkout touches files). */
function sources() {
  const files = [];
  const add = (path) => files.push({ path, hash: createHash("sha256").update(readFileSync(root + path)).digest("hex") });
  const walk = (dir) => {
    for (const entry of readdirSync(root + dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(`${dir}/${entry.name}`);
      else add(`${dir}/${entry.name}`);
    }
  };
  for (const dir of ["apps/mobile/app", "apps/mobile/src", "apps/mobile/public", "apps/mobile/assets", "packages/domain/src", "packages/api-client/src"]) {
    if (existsSync(root + dir)) walk(dir);
  }
  // app.json, package.json, a metro or babel config: the files directly in apps/mobile (not tsconfig or the test setup).
  for (const entry of readdirSync(`${root}apps/mobile`, { withFileTypes: true })) {
    if (entry.isFile() && !/^(tsconfig|vitest)/.test(entry.name)) add(`apps/mobile/${entry.name}`);
  }
  add("package-lock.json");
  return files;
}

const stamp = exportStamp(sources(), process.env);
const exported = existsSync(`${dist}index.html`);
const stored = existsSync(stampFile) ? readFileSync(stampFile, "utf8").trim() : undefined;
if (needsExport({ stamp, stored, exported, force: process.argv.includes("--force") })) {
  // expo export empties dist first, so a failed export leaves no stamp behind.
  const run = spawnSync("npm", ["run", "export", "-w", "@gassi/mobile"], { cwd: root, stdio: "inherit" });
  if (run.status !== 0) process.exit(run.status ?? 1);
  writeFileSync(stampFile, `${stamp}\n`);
  console.log("App exportiert");
} else {
  console.log("App unverändert, Export übersprungen");
}

const previous = existsSync(manifest) ? readFileSync(manifest, "utf8").split("\n").filter(Boolean) : [];
for (const name of previous) rmSync(pub + name, { recursive: true, force: true });

const names = readdirSync(dist).filter((name) => name !== ".stamp");
const clash = names.filter((name) => existsSync(pub + name));
if (clash.length) throw new Error(`The web export would overwrite the server's own public files: ${clash.join(", ")}`);
for (const name of names) cpSync(dist + name, pub + name, { recursive: true });
writeFileSync(manifest, `${names.join("\n")}\n`);
console.log(`Copied the web app into apps/server/public: ${names.join(", ")}`);
