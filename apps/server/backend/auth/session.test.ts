import { describe, expect, test } from "vitest";
import { setEnv, withEnv } from "../testing/env";
import { endSessionCookie, sessionCookie, sessionUser } from "./session";

withEnv();
const HIRSCH = { id: "marcel", name: "Hirsch" };
const HERZII = { id: "bille", name: "Herzii" };
const NOW = 1_800_000_000_000;
const valueOf = (setCookie: string) => setCookie.split(";")[0].split("=").slice(1).join("=");

describe("the session cookie", () => {
  test("is HttpOnly, SameSite=Lax, Secure on https and lasts 30 days", () => {
    expect(sessionCookie(HIRSCH, NOW)).toMatch(/^gassi_session=[^;]+; Path=\/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure$/);
  });

  test("is not Secure on plain http", () => {
    setEnv({ PUBLIC_URL: "http://localhost:3000" });
    expect(sessionCookie(HIRSCH, NOW)).not.toContain("Secure");
  });

  test("names its user and their display name", () => {
    expect(sessionUser(valueOf(sessionCookie(HERZII, NOW)), NOW)).toEqual({ id: "bille", name: "Herzii" });
  });

  test("expires after 30 days", () => {
    const value = valueOf(sessionCookie(HIRSCH, NOW));
    expect(sessionUser(value, NOW + 30 * 86_400_000 - 1000)).not.toBeNull();
    expect(sessionUser(value, NOW + 30 * 86_400_000)).toBeNull();
  });

  test("a tampered value names nobody", () => {
    const value = valueOf(sessionCookie(HIRSCH, NOW));
    expect(sessionUser(`x${value}`, NOW)).toBeNull();
    expect(sessionUser(undefined, NOW)).toBeNull();
  });

  test("a new SECRET signs everyone out", () => {
    const value = valueOf(sessionCookie(HIRSCH, NOW));
    setEnv({ SECRET: "another-secret-".padEnd(32, "y") });
    expect(sessionUser(value, NOW)).toBeNull();
  });

  test("ending it clears the cookie", () => {
    expect(endSessionCookie()).toMatch(/^gassi_session=; Path=\/; Max-Age=0;/);
  });
});
