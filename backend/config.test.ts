import { describe, expect, test } from "vitest";
import { parseConfig } from "./config";

const ENV = {
  PUBLIC_URL: "https://gassi.example/",
  SECRET: "x".repeat(32),
  OIDC_ISSUER: "https://auth.example/application/o/gassi/",
  OIDC_CLIENT_ID: "gassi",
  OIDC_CLIENT_SECRET: "client-secret",
};

describe("parseConfig", () => {
  test("reads the required variables and fills in defaults", () => {
    const c = parseConfig(ENV);
    expect(c.publicUrl).toBe("https://gassi.example");
    expect(c).toMatchObject({ dogName: "Toffee", dataDir: "./data", timeZone: "Europe/Berlin", apiToken: undefined, logLevel: "info" });
  });

  test("an empty optional variable means its default", () => {
    expect(parseConfig({ ...ENV, DOG_NAME: "", API_TOKEN: "" })).toMatchObject({ dogName: "Toffee", apiToken: undefined });
  });

  test.each(Object.keys(ENV))("a missing %s fails with its name", (name) => {
    expect(() => parseConfig({ ...ENV, [name]: undefined })).toThrow(name);
  });

  test.each([
    ["SECRET", "short"],
    ["PUBLIC_URL", "ftp://gassi.example"],
    ["TZ", "Mars/Olympus"],
    ["API_TOKEN", "short"],
    ["LOG_LEVEL", "loud"],
  ])("an invalid %s fails with its name", (name, value) => {
    expect(() => parseConfig({ ...ENV, [name]: value })).toThrow(name);
  });
});

test("a missing variable says it is required", () => {
  expect(() => parseConfig({ ...ENV, OIDC_CLIENT_ID: undefined })).toThrow("OIDC_CLIENT_ID is required");
});
