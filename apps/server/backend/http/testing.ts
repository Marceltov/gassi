// For API tests: calls the router as an HTTP client would, with a device token for Hirsch or Herzii.
import { Devices } from "../auth/devices";
import type { DB } from "../db/open";
import { apiRouter, type ApiDeps } from "./api";

export const TEST_URL = "https://gassi.example";
/** The key link codes are hashed with in tests (secret.ts linkCodeKey in the server). */
export const TEST_CODE_KEY = "test-code-key";

export function apiCaller(db: () => DB, now: () => Date, more: () => Partial<ApiDeps> = () => ({})) {
  const call = (path: string, init: { method?: string; token?: string; body?: unknown } = {}) =>
    apiRouter({ db: db(), now, publicUrl: TEST_URL, codeKey: TEST_CODE_KEY, oidc: false, mailer: null, ...more() })(
      new Request(`${TEST_URL}${path}`, {
        method: init.method ?? "GET",
        headers: { "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
    );
  const json = async (path: string, init: { method?: string; token?: string; body?: unknown } = {}) => {
    const res = await call(path, init);
    return { status: res.status, body: await res.json() };
  };
  const tokenFor = async (personId: string) => (await new Devices(db(), now).create(personId, { kind: "phone", name: "Testgerät" })).token;
  return { call, json, tokenFor };
}
