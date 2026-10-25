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
      defaultDogName: null,
      dataDir: "./data",
      timeZone: "Europe/Berlin",
      logLevel: "info",
      setupLinkFile: null,
      corsOrigin: null,
      github: null,
      clientEvents: "all",
    });
  });

  test("CLIENT_EVENTS says what the server keeps of the app's events", () => {
    expect(parseConfig({ ...ENV, CLIENT_EVENTS: "errors" }).clientEvents).toBe("errors");
    expect(parseConfig({ ...ENV, CLIENT_EVENTS: "off" }).clientEvents).toBe("off");
    expect(() => parseConfig({ ...ENV, CLIENT_EVENTS: "some" })).toThrow("CLIENT_EVENTS");
  });

  test("Wünsche und Fehler need the repo (owner/name) and its token together", () => {
    expect(parseConfig({ ...ENV, FEEDBACK_GITHUB_REPO: "Marceltov/gassi", FEEDBACK_GITHUB_TOKEN: "t" }).github).toEqual({ repo: "Marceltov/gassi", token: "t" });
    const together = "FEEDBACK_GITHUB_REPO and FEEDBACK_GITHUB_TOKEN go together";
    expect(() => parseConfig({ ...ENV, FEEDBACK_GITHUB_REPO: "Marceltov/gassi" })).toThrow(together);
    expect(() => parseConfig({ ...ENV, FEEDBACK_GITHUB_TOKEN: "t" })).toThrow(together);
    expect(() => parseConfig({ ...ENV, FEEDBACK_GITHUB_REPO: "https://github.com/Marceltov/gassi", FEEDBACK_GITHUB_TOKEN: "t" })).toThrow("FEEDBACK_GITHUB_REPO must be owner/name");
  });

  test("OIDC is all three or none", () => {
    expect(parseConfig({ ...ENV, ...OIDC }).oidc).toEqual({ issuer: OIDC.OIDC_ISSUER, clientId: "gassi", clientSecret: "client-secret" });
    const together = "OIDC_ISSUER, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET go together";
    expect(() => parseConfig({ ...ENV, OIDC_ISSUER: OIDC.OIDC_ISSUER })).toThrow(together);
    expect(() => parseConfig({ ...ENV, OIDC_CLIENT_ID: "gassi" })).toThrow(together);
    expect(() => parseConfig({ ...ENV, OIDC_CLIENT_ID: "gassi", OIDC_CLIENT_SECRET: "s" })).toThrow(together);
  });

  test("SMTP_URL alone is enough for mail; MAIL_FROM defaults to gassi@ the server's host", () => {
    expect(parseConfig({ ...ENV, SMTP_URL: "smtp://user:pw@mail.example:587" }).smtp).toEqual({ url: "smtp://user:pw@mail.example:587", from: "gassi@gassi.example" });
    expect(parseConfig({ ...ENV, SMTP_URL: "smtps://mail.example", MAIL_FROM: "Gassi <hund@example.org>" }).smtp).toEqual({ url: "smtps://mail.example", from: "Gassi <hund@example.org>" });
  });

  test("CORS_ORIGIN is an http(s) origin: scheme, host and port, nothing after", () => {
    expect(parseConfig({ ...ENV, CORS_ORIGIN: "http://localhost:8081/" }).corsOrigin).toBe("http://localhost:8081");
    expect(parseConfig({ ...ENV, CORS_ORIGIN: "HTTP://LocalHost:8081/app/?x=1#y" }).corsOrigin).toBe("http://localhost:8081");
    expect(parseConfig({ ...ENV, CORS_ORIGIN: "" }).corsOrigin).toBeNull();
    expect(() => parseConfig({ ...ENV, CORS_ORIGIN: "localhost:8081" })).toThrow("CORS_ORIGIN");
  });

  test("an empty optional variable means its default", () => {
    expect(parseConfig({ ...ENV, DOG_NAME: "", SECRET: "", SMTP_URL: "" })).toMatchObject({ defaultDogName: null, secret: null, smtp: null });
    expect(parseConfig({ ...ENV, DOG_NAME: " Toffee " }).defaultDogName).toBe("Toffee");
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
