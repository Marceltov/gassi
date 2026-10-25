import { createHash, createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildManifest, signManifest, verifyManifest } from "../scripts/app-update-manifest.mjs";

const files: Record<string, string> = { "_expo/static/js/android/index-abc.hbc": "bundle", "assets/0a32": "png bytes" };
const metadata = { fileMetadata: { android: { bundle: "_expo/static/js/android/index-abc.hbc", assets: [{ path: "assets/0a32", ext: "png" }] } } };
const read = (path: string) => Buffer.from(files[path]!);
const hash = (s: string) => createHash("sha256").update(s).digest("base64url");
const md5 = (s: string) => createHash("md5").update(s).digest("hex");
const expoClient = { name: "Gassi", version: "0.3.0", updates: { url: "https://gassi.herziis.de/api/updates/manifest" } };
const build = (createdAt = "2026-10-25T12:00:00.000Z", stamp = "stamp-1") => buildManifest({ metadata, read, runtimeVersion: "1", createdAt, stamp, expoClient });

describe("buildManifest", () => {
  it("lists the bundle and its assets by root-relative address, with their hashes; a key is the MD5 the bundle looks assets up by", () => {
    const m = JSON.parse(build());
    expect(m).toMatchObject({
      createdAt: "2026-10-25T12:00:00.000Z",
      runtimeVersion: "1",
      launchAsset: { hash: hash("bundle"), key: md5("bundle"), contentType: "application/javascript", url: "/_expo/static/js/android/index-abc.hbc" },
      assets: [{ hash: hash("png bytes"), key: md5("png bytes"), contentType: "image/png", fileExtension: ".png", url: "/assets/0a32" }],
      metadata: {},
      extra: { expoClient },
    });
    expect(m.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("names the update by the app's sources (the export's stamp), not the bundle's bytes, which differ between builds", () => {
    const first = JSON.parse(build()).id;
    files["_expo/static/js/android/index-abc.hbc"] = "rebuilt from the same sources";
    expect(JSON.parse(build("2026-10-26T12:00:00.000Z")).id).toBe(first);
    files["_expo/static/js/android/index-abc.hbc"] = "bundle";
    expect(JSON.parse(build(undefined, "stamp-2")).id).not.toBe(first);
  });
});

describe("signManifest", () => {
  it("signs the manifest's exact text: the matching public key verifies it, another doesn't", () => {
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const text = build();
    const sig = signManifest(text, pair.privateKey.export({ type: "pkcs1", format: "pem" }).toString());
    const verify = (key: typeof pair.publicKey, t: string) => createVerify("RSA-SHA256").update(t).verify(key, sig, "base64");
    expect(verify(pair.publicKey, text)).toBe(true);
    expect(verify(other.publicKey, text)).toBe(false);
    expect(verify(pair.publicKey, `${text} `)).toBe(false);
  });
});

describe("verifyManifest", () => {
  it("checks a signature against the app's certificate (here its public key): a key that doesn't match fails the build", () => {
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const text = build();
    const sig = signManifest(text, pair.privateKey.export({ type: "pkcs1", format: "pem" }).toString());
    expect(verifyManifest(text, sig, pair.publicKey.export({ type: "spki", format: "pem" }).toString())).toBe(true);
    expect(verifyManifest(text, sig, other.publicKey.export({ type: "spki", format: "pem" }).toString())).toBe(false);
  });
});
