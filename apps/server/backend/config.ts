// Every environment variable the server reads, parsed and checked once (zod). A missing or invalid variable fails with
// its name. config() is what the app uses; parseConfig() is the pure part, for tests.
import { z } from "zod";
import { processState } from "./state";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const validTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

// Unset and empty are the same: the default (or missing, when required).
const optional = <T extends z.ZodType>(s: T) => z.preprocess((v) => (v === "" ? undefined : v), s.optional());
const required = z.string({ error: "is required" }).trim().min(1, "is required");

const schema = z
  .object({
    PUBLIC_URL: required.pipe(z.url({ protocol: /^https?$/ })).transform((u) => u.replace(/\/+$/, "")),
    SECRET: optional(z.string().min(32, "must be at least 32 characters")),
    OIDC_ISSUER: optional(z.url()),
    OIDC_CLIENT_ID: optional(z.string().trim().min(1)),
    OIDC_CLIENT_SECRET: optional(z.string().trim().min(1)),
    SMTP_URL: optional(z.url({ protocol: /^smtps?$/, error: "must be an smtp:// or smtps:// URL" })),
    MAIL_FROM: optional(z.string().trim().min(3)),
    DOG_NAME: optional(z.string().trim().min(1)),
    DATA_DIR: optional(z.string()).default("./data"),
    TZ: optional(z.string().refine(validTimeZone, "is not a time zone")).default("Europe/Berlin"),
    LOG_LEVEL: optional(z.enum(LOG_LEVELS)).default("info"),
    SETUP_LINK_FILE: optional(z.string()),
    CORS_ORIGIN: optional(z.url({ protocol: /^https?$/ })).transform((u) => u?.replace(/\/+$/, "")),
  })
  .refine((c) => new Set([!!c.OIDC_ISSUER, !!c.OIDC_CLIENT_ID, !!c.OIDC_CLIENT_SECRET]).size === 1, { path: ["OIDC_ISSUER"], message: "OIDC_ISSUER, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET go together" });

/** Only PUBLIC_URL is required. OIDC (all three variables or none) and mail (SMTP_URL) are optional features. */
export type Config = {
  publicUrl: string;
  secret: string | null; // else one is kept in DATA_DIR (secret.ts)
  oidc: { issuer: string; clientId: string; clientSecret: string } | null;
  smtp: { url: string; from: string } | null;
  defaultDogName: string | null; // the first dog's name when setup doesn't say
  dataDir: string;
  timeZone: string;
  logLevel: (typeof LOG_LEVELS)[number];
  setupLinkFile: string | null; // where the setup link is also written (the e2e tests read it there)
  corsOrigin: string | null; // dev only: the Expo dev server (http://localhost:8081) calling the API from another origin
};

export function parseConfig(env: Record<string, string | undefined>): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => (i.message.startsWith("OIDC_") ? i.message : `${i.path.join(".")} ${i.message}`));
    throw new Error(`Invalid configuration: ${problems.join("; ")}`);
  }
  const c = parsed.data;
  return {
    publicUrl: c.PUBLIC_URL,
    secret: c.SECRET ?? null,
    oidc: c.OIDC_ISSUER ? { issuer: c.OIDC_ISSUER, clientId: c.OIDC_CLIENT_ID!, clientSecret: c.OIDC_CLIENT_SECRET! } : null,
    smtp: c.SMTP_URL ? { url: c.SMTP_URL, from: c.MAIL_FROM ?? `gassi@${new URL(c.PUBLIC_URL).hostname}` } : null,
    defaultDogName: c.DOG_NAME ?? null,
    dataDir: c.DATA_DIR,
    timeZone: c.TZ,
    logLevel: c.LOG_LEVEL,
    setupLinkFile: c.SETUP_LINK_FILE ?? null,
    corsOrigin: c.CORS_ORIGIN ?? null,
  };
}

const cache = processState("config", () => ({ current: undefined as Config | undefined }));

export function config(): Config {
  return (cache.current ??= parseConfig(process.env));
}

// For tests: the next config() reads the environment again.
export function resetConfigForTests(): void {
  cache.current = undefined;
}
