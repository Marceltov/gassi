import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadUpdate, updateResponse } from "./updates";

const manifest = JSON.stringify({ id: "d643bae4-d83a-4a7a-8fc2-8e0892095ac0", runtimeVersion: "1" });
const update = { manifest, signature: "c2lnbmF0dXJl", runtimeVersion: "1" };
const ask = (over: Partial<{ platform: string | null; runtimeVersion: string | null; expectSignature: boolean }> = {}) => ({ platform: "android", runtimeVersion: "1", expectSignature: true, ...over });

describe("updateResponse", () => {
  test("the update for this runtime: one signed manifest part, with the protocol's headers", () => {
    const r = updateResponse(ask(), update);
    expect(r.status).toBe(200);
    expect(r.headers).toMatchObject({ "expo-protocol-version": "1", "expo-sfv-version": "0", "cache-control": "private, max-age=0" });
    const boundary = r.headers["content-type"]!.match(/^multipart\/mixed; boundary=(.+)$/)![1];
    expect(r.body).toBe(
      `--${boundary}\r\ncontent-disposition: form-data; name="manifest"\r\ncontent-type: application/json; charset=utf-8\r\nexpo-signature: sig="c2lnbmF0dXJl", keyid="main"\r\n\r\n${manifest}\r\n--${boundary}--\r\n`,
    );
  });

  test("an app that doesn't check signatures gets the manifest without one", () => {
    expect(updateResponse(ask({ expectSignature: false }), update).body).not.toContain("expo-signature");
  });

  test("nothing for another runtime, without an update, or unsigned to an app that checks: 204", () => {
    expect(updateResponse(ask({ runtimeVersion: "2" }), update).status).toBe(204);
    expect(updateResponse(ask(), null).status).toBe(204);
    expect(updateResponse(ask(), { ...update, signature: null }).status).toBe(204);
    expect(updateResponse(ask(), null).headers).toMatchObject({ "expo-protocol-version": "1" });
  });

  test("only Android asks: another platform or none is 400", () => {
    expect(updateResponse(ask({ platform: "ios" }), update).status).toBe(400);
    expect(updateResponse(ask({ platform: null }), update).status).toBe(400);
    expect(updateResponse(ask({ runtimeVersion: null }), update).status).toBe(400);
  });
});

describe("loadUpdate", () => {
  test("reads the image's manifest, its runtime and its signature; null without a manifest", () => {
    const dir = mkdtempSync(join(tmpdir(), "update-"));
    expect(loadUpdate(dir)).toBeNull();
    writeFileSync(join(dir, "android.json"), manifest);
    expect(loadUpdate(dir)).toEqual({ manifest, signature: null, runtimeVersion: "1" });
    writeFileSync(join(dir, "android.sig"), "c2ln\n");
    expect(loadUpdate(dir)).toEqual({ manifest, signature: "c2ln", runtimeVersion: "1" });
  });
});
