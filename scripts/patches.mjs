// Our fixes to installed packages (#131): apps/mobile/patches/<package>+<version>.patch, made against node_modules at
// the repo root. Installs run without scripts (.npmrc), so nothing applies them on install; the APK's EAS build does
// (eas-build-post-install in apps/mobile/package.json), since only native code is patched. Expo's fingerprint hashes
// the patches folder, so a new or changed patch needs a new runtime version. tooling/patches.test.ts checks that each
// one still fits the installed package.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = `${root}apps/mobile/patches/`;

/** The package and version a patch's file name names (scoped packages write their slash as "+"). */
export function patchTarget(file) {
  const parts = file.replace(/\.patch$/, "").split("+");
  const version = parts.pop();
  return { name: parts.join("/"), version };
}

const fits = (args, patch) => {
  try {
    execFileSync("git", ["apply", "--check", ...args, patch], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

/** Each patch's state against node_modules: applied, ready to apply, or a problem to fix. */
export function patchStates() {
  return readdirSync(dir).filter((f) => f.endsWith(".patch")).sort().map((file) => {
    const { name, version } = patchTarget(file);
    const patch = `${dir}${file}`;
    const installed = JSON.parse(readFileSync(`${root}node_modules/${name}/package.json`, "utf8")).version;
    if (installed !== version) return { file, state: `made for ${name} ${version}, installed is ${installed}: redo it` };
    if (fits(["--reverse"], patch)) return { file, state: "applied" };
    if (fits([], patch)) return { file, state: "ready" };
    return { file, state: "does not apply: redo it" };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const { file, state } of patchStates()) {
    if (state === "ready") execFileSync("git", ["apply", `${dir}${file}`], { cwd: root, stdio: "inherit" });
    else if (state !== "applied") {
      console.error(`${file}: ${state}`);
      process.exit(1);
    }
    console.log(`${file}: applied`);
  }
}
