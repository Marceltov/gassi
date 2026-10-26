// The Android app's runtime version (#107, ADR 0015): a number in apps/mobile/app.json that names one set of native
// parts. An update only reaches APKs of its runtime, so native parts must not change under the same number. Expo's
// fingerprint (a hash over the native parts) is recorded per runtime in apps/mobile/runtime.json; `check` fails when
// it changed without a bump (CI), `record` writes it after a bump (npm run runtime:record). Android's versionCode is
// the runtime too, so the system sees a new APK as newer.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** null when the runtime fits its native parts, else what to do. */
export function checkRuntime({ runtimeVersion, versionCode, recorded, fingerprint }) {
  if (String(versionCode) !== runtimeVersion) return `android.versionCode (${versionCode}) must be the runtime version (${runtimeVersion}) in apps/mobile/app.json.`;
  if (!(runtimeVersion in recorded)) return `Runtime ${runtimeVersion} has no recorded fingerprint: run npm run runtime:record.`;
  if (recorded[runtimeVersion] !== fingerprint) return "Native parts changed: bump runtimeVersion in apps/mobile/app.json and record the fingerprint (npm run runtime:record).";
  return null;
}

const mobile = fileURLToPath(new URL("../apps/mobile/", import.meta.url));
const runtimeFile = `${mobile}runtime.json`;

function current() {
  const out = execFileSync("npx", ["expo-updates", "fingerprint:generate", "--platform", "android"], { cwd: mobile, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const { expo } = JSON.parse(readFileSync(`${mobile}app.json`, "utf8"));
  return { runtimeVersion: expo.runtimeVersion, versionCode: expo.android.versionCode, fingerprint: JSON.parse(out).hash };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { runtimeVersion, versionCode, fingerprint } = current();
  const recorded = JSON.parse(readFileSync(runtimeFile, "utf8"));
  if (process.argv[2] === "record") {
    writeFileSync(runtimeFile, `${JSON.stringify({ ...recorded, [runtimeVersion]: fingerprint }, null, 2)}\n`);
    console.log(`Runtime ${runtimeVersion}: ${fingerprint}`);
  } else {
    const problem = checkRuntime({ runtimeVersion, versionCode, recorded, fingerprint });
    if (problem) {
      console.error(problem);
      process.exit(1);
    }
    console.log(`Runtime ${runtimeVersion} fits its native parts.`);
  }
}
