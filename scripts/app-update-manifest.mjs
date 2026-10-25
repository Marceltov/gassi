// The Android app's update (#107, ADR 0015), as the expo-updates protocol (v1) describes it: the bundle and its assets
// from `expo export`'s metadata.json, each with its SHA-256 (base64url) and a root-relative address. The app resolves
// those against the update URL of the server it asks, so one manifest, signed once in CI, serves every household's
// server unchanged. A key is the file's MD5, which is how the bundle looks its assets up. The update is named by the
// app's sources (the export's stamp), since Hermes bundles differ between builds of the same sources; the app skips an
// update it already runs (updatePolicy.ts isNewUpdate). `extra.expoClient` is the app's public config, which
// expo-constants reads from the running update.
import { createHash, createSign, createVerify } from "node:crypto";

const TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", ttf: "font/ttf", otf: "font/otf", json: "application/json" };

const digest = (algorithm, data, encoding) => createHash(algorithm).update(data).digest(encoding);

// a UUID (v4 form) from the stamp: the same sources are the same update
function idOf(stamp) {
  const h = digest("sha256", stamp, "hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** The manifest's JSON text, for `metadata` (expo export's metadata.json), reading files by their path in the export. */
export function buildManifest({ metadata, read, runtimeVersion, createdAt, stamp, expoClient }) {
  const android = metadata.fileMetadata.android;
  const bundle = read(android.bundle);
  const asset = ({ path, ext }) => {
    const bytes = read(path);
    return { hash: digest("sha256", bytes, "base64url"), key: digest("md5", bytes, "hex"), contentType: TYPES[ext] ?? "application/octet-stream", fileExtension: `.${ext}`, url: `/${path}` };
  };
  const launchAsset = { hash: digest("sha256", bundle, "base64url"), key: digest("md5", bundle, "hex"), contentType: "application/javascript", url: `/${android.bundle}` };
  return JSON.stringify({ id: idOf(stamp), createdAt, runtimeVersion, launchAsset, assets: android.assets.map(asset), metadata: {}, extra: { expoClient } });
}

/** Whether `signature` is valid for `text` under `certificatePem` (the app's certificate): a CI key that doesn't belong
 * to it would make every phone reject the update. */
export function verifyManifest(text, signature, certificatePem) {
  return createVerify("RSA-SHA256").update(text).verify(certificatePem, signature, "base64");
}

/** The signature the app checks (rsa-v1_5-sha256 over the exact text), base64. */
export function signManifest(text, privateKeyPem) {
  return createSign("RSA-SHA256").update(text).sign(privateKeyPem, "base64");
}
