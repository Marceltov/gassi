// The Android app's update (#107, ADR 0015), served with the expo-updates protocol (v1): the manifest the image build
// wrote and CI signed (public/_app-update/android.json and .sig, scripts/web.mjs), handed out exactly as signed. The
// bundle and its assets are plain public files next to the web app's. The server never holds the signing key.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Update = { manifest: string; signature: string | null; runtimeVersion: string };
type Ask = { platform: string | null; runtimeVersion: string | null; expectSignature: boolean };
type Answer = { status: number; headers: Record<string, string>; body: string | null };

/** Where the image keeps the update: public/_app-update (Next's standalone server runs in apps/server). */
export const UPDATE_DIR = join(process.cwd(), "public", "_app-update");

/** The image's update, or null when it has none (a build without the Android export). */
export function loadUpdate(dir = UPDATE_DIR): Update | null {
  const file = join(dir, "android.json");
  if (!existsSync(file)) return null;
  const manifest = readFileSync(file, "utf8");
  const sig = join(dir, "android.sig");
  const runtimeVersion = String((JSON.parse(manifest) as { runtimeVersion: unknown }).runtimeVersion);
  return { manifest, signature: existsSync(sig) ? readFileSync(sig, "utf8").trim() : null, runtimeVersion };
}

const PROTOCOL = { "expo-protocol-version": "1", "expo-sfv-version": "0", "cache-control": "private, max-age=0" };

/** The answer to an app asking for its update: the manifest for its runtime, else nothing (204). An app that checks
 * signatures never gets an unsigned one. */
export function updateResponse(ask: Ask, update: Update | null): Answer {
  if (ask.platform !== "android" || !ask.runtimeVersion) return { status: 400, headers: PROTOCOL, body: null };
  if (!update || update.runtimeVersion !== ask.runtimeVersion || (ask.expectSignature && !update.signature)) return { status: 204, headers: PROTOCOL, body: null };
  const boundary = randomUUID();
  const signed = ask.expectSignature ? `expo-signature: sig="${update.signature}", keyid="main"\r\n` : "";
  const body = `--${boundary}\r\ncontent-disposition: form-data; name="manifest"\r\ncontent-type: application/json; charset=utf-8\r\n${signed}\r\n${update.manifest}\r\n--${boundary}--\r\n`;
  return { status: 200, headers: { ...PROTOCOL, "content-type": `multipart/mixed; boundary=${boundary}` }, body };
}
