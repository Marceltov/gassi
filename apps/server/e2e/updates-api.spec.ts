// The Android app's update through the real server (#107): the protocol's answer and the bundle it names, served
// from public/ with a long cache (its name changes with its content). The e2e build is unsigned: an app that checks
// signatures gets nothing.
import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";

const ask = (headers: Record<string, string>) => fetch(`${BASE_URL}/api/updates/manifest`, { headers: { "expo-protocol-version": "1", "expo-platform": "android", "expo-runtime-version": "1", ...headers } });

test("the update's manifest for runtime 1, its bundle cached for good; nothing unsigned to an app that checks", async () => {
  const plain = await ask({});
  expect(plain.status).toBe(200);
  expect(plain.headers.get("expo-protocol-version")).toBe("1");
  const body = await plain.text();
  const manifest = JSON.parse(body.split("\r\n\r\n")[1]!.split("\r\n--")[0]!) as { runtimeVersion: string; launchAsset: { url: string } };
  expect(manifest.runtimeVersion).toBe("1");
  const bundle = await fetch(`${BASE_URL}${manifest.launchAsset.url}`);
  expect(bundle.status).toBe(200);
  expect(bundle.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  expect((await ask({ "expo-expect-signature": 'sig, keyid="main", alg="rsa-v1_5-sha256"' })).status).toBe(204);
  expect((await ask({ "expo-runtime-version": "2" })).status).toBe(204);
  expect((await ask({ "expo-platform": "ios" })).status).toBe(400);
  expect(await (await fetch(`${BASE_URL}/api/app`)).json()).toEqual({ runtimeVersion: "1" });
});
