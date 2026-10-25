// How many EAS builds this month (#107): the APK job stops before the free plan's 15 run out (EAS_KEEP spare for
// builds by hand). Reads `eas build:list --json` on stdin; exits 1 when the cap is reached.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The builds started in `now`'s month (UTC). */
export const buildsThisMonth = (builds, now) => builds.filter((b) => b.createdAt.slice(0, 7) === now.toISOString().slice(0, 7)).length;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cap = Number(process.argv[2] ?? 12);
  const count = buildsThisMonth(JSON.parse(readFileSync(0, "utf8")), new Date());
  console.log(`${count} EAS builds this month (cap ${cap})`);
  if (count >= cap) {
    console.log(`::error::${count} EAS builds this month: the APK is left to a build by hand`);
    process.exit(1);
  }
}
