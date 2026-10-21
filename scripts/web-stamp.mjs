// Decides whether the Expo web export has to run again. Pure: web.mjs reads the files and the environment, this turns
// them into a stamp and compares it with the one stored next to the last export.
import { createHash } from "node:crypto";

/** A hash over every file's path and content and over the EXPO_PUBLIC_* variables (they end up in the bundle). */
export function exportStamp(files, env) {
  const hash = createHash("sha256");
  for (const { path, hash: content } of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    hash.update(`file ${path} ${content}\n`);
  }
  for (const name of Object.keys(env).filter((key) => key.startsWith("EXPO_PUBLIC_")).sort()) {
    hash.update(`env ${name}=${env[name]}\n`);
  }
  return hash.digest("hex");
}

/** The export runs when forced, when there is none, or when the stamp stored with it differs from today's. */
export function needsExport({ stamp, stored, exported, force }) {
  return force || !exported || stored !== stamp;
}
