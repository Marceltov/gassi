// Every environment variable the app reads, parsed and checked once (zod). A missing or invalid variable fails with its
// name. config() is what the app uses; parseConfig() is the pure part, for tests.
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

const schema = z.object({
  PUBLIC_URL: required.pipe(z.url({ protocol: /^https?$/ })).transform((u) => u.replace(/\/+$/, "")),
  SECRET: required.pipe(z.string().min(32, "must be at least 32 characters")),
  OIDC_ISSUER: required.pipe(z.url()),
  OIDC_CLIENT_ID: required,
  OIDC_CLIENT_SECRET: required,
  DOG_NAME: optional(z.string().trim()).default("Toffee"),
  DATA_DIR: optional(z.string()).default("./data"),
  TZ: optional(z.string().refine(validTimeZone, "is not a time zone")).default("Europe/Berlin"),
  API_TOKEN: optional(z.string().min(16, "must be at least 16 characters")),
  LOG_LEVEL: optional(z.enum(LOG_LEVELS)).default("info"),
});

export type Config = {
  publicUrl: string;
  secret: string;
  oidc: { issuer: string; clientId: string; clientSecret: string };
  dogName: string;
  dataDir: string;
  timeZone: string;
  apiToken: string | undefined;
  logLevel: (typeof LOG_LEVELS)[number];
};

export function parseConfig(env: Record<string, string | undefined>): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`);
    throw new Error(`Invalid configuration: ${problems.join("; ")}`);
  }
  const c = parsed.data;
  return {
    publicUrl: c.PUBLIC_URL,
    secret: c.SECRET,
    oidc: { issuer: c.OIDC_ISSUER, clientId: c.OIDC_CLIENT_ID, clientSecret: c.OIDC_CLIENT_SECRET },
    dogName: c.DOG_NAME,
    dataDir: c.DATA_DIR,
    timeZone: c.TZ,
    apiToken: c.API_TOKEN,
    logLevel: c.LOG_LEVEL,
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
