import { describe, expect, test } from "vitest";
import { parseConfig } from "./config";

const ENV = { PUBLIC_URL: "https://gassi.example/" };
const OIDC = { OIDC_ISSUER: "https://auth.example/application/o/gassi/", OIDC_CLIENT_ID: "gassi", OIDC_CLIENT_SECRET: "client-secret" };

describe("parseConfig", () => {
  test("PUBLIC_URL is all a server needs; everything else has a default", () => {
    expect(parseConfig(ENV)).toEqual({
      publicUrl: "https://gassi.example",
      secret: null,
      oidc: null,
      smtp: null,
      defaultDogName: "Toffee",
      dataDir: "./data",
      timeZone: "Europe/Berlin",
      logLevel: "info",
      setupLinkFile: null,
    });
  });

  test("OIDC is all three or none", () => {
    expect(parseConfig({ ...ENV, ...OIDC }).oidc).toEqual({ issuer: OIDC.OIDC_ISSUER, clientId: "gassi", clientSecret: "client-secret" });
    expect(() => parseConfig({ ...ENV, OIDC_ISSUER: OIDC.OIDC_ISSUER })).toThrow("OIDC_CLIENT_ID and OIDC_CLIENT_SECRET are needed with OIDC_ISSUER");
  });

  test("SMTP_URL alone is enough for mail; MAIL_FROM defaults to gassi@ the server's host", () => {
    expect(parseConfig({ ...ENV, SMTP_URL: "smtp://user:pw@mail.example:587" }).smtp).toEqual({ url: "smtp://user:pw@mail.example:587", from: "gassi@gassi.example" });
    expect(parseConfig({ ...ENV, SMTP_URL: "smtps://mail.example", MAIL_FROM: "Gassi <hund@example.org>" }).smtp).toEqual({ url: "smtps://mail.example", from: "Gassi <hund@example.org>" });
  });

  test("an empty optional variable means its default", () => {
    expect(parseConfig({ ...ENV, DOG_NAME: "", SECRET: "", SMTP_URL: "" })).toMatchObject({ defaultDogName: "Toffee", secret: null, smtp: null });
  });

  test("a missing PUBLIC_URL says it is required", () => {
    expect(() => parseConfig({})).toThrow("PUBLIC_URL is required");
  });

  test.each([
    ["SECRET", "short"],
    ["PUBLIC_URL", "ftp://gassi.example"],
    ["TZ", "Mars/Olympus"],
    ["SMTP_URL", "http://mail.example"],
    ["LOG_LEVEL", "loud"],
  ])("an invalid %s fails with its name", (name, value) => {
    expect(() => parseConfig({ ...ENV, [name]: value })).toThrow(name);
  });
});
