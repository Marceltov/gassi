import { describe, expect, test } from "vitest";
import { setEnv, withEnv } from "../testing/env";
import { endSessionCookie, sessionCookie, sessionUser } from "./session";

withEnv();
const NOW = 1_800_000_000_000;
const valueOf = (setCookie: string) => setCookie.split(";")[0].split("=").slice(1).join("=");

describe("the session cookie", () => {
  test("is HttpOnly, SameSite=Lax, Secure on https and lasts 30 days", () => {
    expect(sessionCookie("marcel", NOW)).toMatch(/^gassi_session=[^;]+; Path=\/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure$/);
  });

  test("is not Secure on plain http", () => {
    setEnv({ PUBLIC_URL: "http://localhost:3000" });
    expect(sessionCookie("marcel", NOW)).not.toContain("Secure");
  });

  test("names its user with the display name", () => {
    expect(sessionUser(valueOf(sessionCookie("bille", NOW)), NOW)).toEqual({ username: "bille", name: "Herzii" });
  });

  test("expires after 30 days", () => {
    const value = valueOf(sessionCookie("marcel", NOW));
    expect(sessionUser(value, NOW + 30 * 86_400_000 - 1000)).not.toBeNull();
    expect(sessionUser(value, NOW + 30 * 86_400_000)).toBeNull();
  });

  test("a tampered value names nobody", () => {
    const value = valueOf(sessionCookie("marcel", NOW));
    expect(sessionUser(`x${value}`, NOW)).toBeNull();
    expect(sessionUser(undefined, NOW)).toBeNull();
  });

  test("a user taken out of USERS is signed out", () => {
    const value = valueOf(sessionCookie("bille", NOW));
    setEnv({ USERS: "marcel:Hirsch" });
    expect(sessionUser(value, NOW)).toBeNull();
  });

  test("a new SECRET signs everyone out", () => {
    const value = valueOf(sessionCookie("marcel", NOW));
    setEnv({ SECRET: "another-secret-".padEnd(32, "y") });
    expect(sessionUser(value, NOW)).toBeNull();
  });

  test("ending it clears the cookie", () => {
    expect(endSessionCookie()).toMatch(/^gassi_session=; Path=\/; Max-Age=0;/);
  });
});
