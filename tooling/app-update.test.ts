import { createHash, createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildManifest, signManifest } from "../scripts/app-update-manifest.mjs";

const files: Record<string, string> = { "_expo/static/js/android/index-abc.hbc": "bundle", "assets/0a32": "png bytes" };
const metadata = { fileMetadata: { android: { bundle: "_expo/static/js/android/index-abc.hbc", assets: [{ path: "assets/0a32", ext: "png" }] } } };
const read = (path: string) => Buffer.from(files[path]!);
const hash = (s: string) => createHash("sha256").update(s).digest("base64url");
const md5 = (s: string) => createHash("md5").update(s).digest("hex");
const build = (createdAt = "2026-10-25T12:00:00.000Z") => buildManifest({ metadata, read, runtimeVersion: "1", createdAt });

describe("buildManifest", () => {
  it("lists the bundle and its assets by root-relative address, with their hashes; a key is the MD5 the bundle looks assets up by", () => {
    const m = JSON.parse(build());
    expect(m).toMatchObject({
      createdAt: "2026-10-25T12:00:00.000Z",
      runtimeVersion: "1",
      launchAsset: { hash: hash("bundle"), key: md5("bundle"), contentType: "application/javascript", url: "/_expo/static/js/android/index-abc.hbc" },
      assets: [{ hash: hash("png bytes"), key: md5("png bytes"), contentType: "image/png", fileExtension: ".png", url: "/assets/0a32" }],
      metadata: {},
      extra: {},
    });
    expect(m.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("gives the same bundle the same id, another bundle another", () => {
    const first = JSON.parse(build()).id;
    expect(JSON.parse(build("2026-10-26T12:00:00.000Z")).id).toBe(first);
    files["_expo/static/js/android/index-abc.hbc"] = "changed";
    expect(JSON.parse(build()).id).not.toBe(first);
    files["_expo/static/js/android/index-abc.hbc"] = "bundle";
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
