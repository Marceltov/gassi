// Failed sign-in codes, counted in leaky buckets: one per client and one for everyone. A code has 40 bits, so guessing
// is already slow, but a guessed setup link hands over the household; this keeps guessing at a crawl. Each failure
// fills a bucket by one and it drains by one every `everyMs`; a client whose bucket (or the shared one) is full waits.
// In memory: a restart forgets, which only gives a guesser one more burst. Reports from the app (#39) are counted the
// same way, per device, with their own limits.

export type Bucket = { burst: number; everyMs: number };

/** 10 wrong codes in a row per client, then one a minute; 30 for everyone together, then one every 10 s. */
export const CODE_LIMITS = { client: { burst: 10, everyMs: 60_000 }, all: { burst: 30, everyMs: 10_000 } };
/** 5 reports in a row per device, then one every 10 minutes; 20 for everyone together, then one a minute. */
export const REPORT_LIMITS = { client: { burst: 5, everyMs: 600_000 }, all: { burst: 20, everyMs: 60_000 } };

type Level = { level: number; at: number };
const ALL = "*";

export class Throttle {
  private readonly levels = new Map<string, Level>();

  constructor(private readonly limits: { client: Bucket; all: Bucket } = CODE_LIMITS) {}

  /** Whether one more count from `client` at `now` (ms) would overflow its bucket or the shared one. */
  blocked(client: string, now: number): boolean {
    return this.level(client, this.limits.client, now) + 1 > this.limits.client.burst || this.level(ALL, this.limits.all, now) + 1 > this.limits.all.burst;
  }

  /** Counts one (a wrong code, a report) from `client` at `now`. */
  count(client: string, now: number): void {
    this.levels.set(client, { level: this.level(client, this.limits.client, now) + 1, at: now });
    this.levels.set(ALL, { level: this.level(ALL, this.limits.all, now) + 1, at: now });
    // clients whose bucket ran dry need not be remembered
    if (this.levels.size > 10_000) for (const [k] of this.levels) if (k !== ALL && this.level(k, this.limits.client, now) === 0) this.levels.delete(k);
  }

  private level(key: string, b: Bucket, now: number): number {
    const l = this.levels.get(key);
    return l ? Math.max(0, l.level - (now - l.at) / b.everyMs) : 0;
  }
}

/** Who is asking, as far as the request says: the first X-Forwarded-For address (set by the proxy in front), else
 * X-Real-IP, else one shared name. A client can make up the header; the shared bucket still holds then. */
export function clientOf(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip")?.trim() || "direct";
}
