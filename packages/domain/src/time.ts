// Wall-clock time in a time zone, with Intl only (it runs in the browser too). Times are stored as UTC ISO strings;
// a "local" value is what a <input type="datetime-local"> holds: "2026-10-20T14:05".

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsIn(ms: number, timeZone: string): Parts {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    formatters.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(ms).map(({ type, value }) => [type, Number(value)]));
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

// How far the zone's wall clock is ahead of UTC at `ms`.
function offsetAt(ms: number, timeZone: string): number {
  const p = partsIn(ms, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-20T14:05" in `timeZone` → the UTC instant (ms). A wall time that happens twice (summer time ending) is its second pass. */
export function localToUtc(local: string, timeZone: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error("not a local date-time");
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const first = asUtc - offsetAt(asUtc, timeZone);
  return asUtc - offsetAt(first, timeZone);
}

/** A UTC instant → "2026-10-20T14:05" in `timeZone`, for a datetime-local input. */
export function utcToLocal(ms: number, timeZone: string): string {
  const p = partsIn(ms, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** The calendar day of `ms` in `timeZone`: "2026-10-20". */
export const dayOf = (ms: number, timeZone: string): string => utcToLocal(ms, timeZone).slice(0, 10);

/** The UTC instants where the day of `ms` in `timeZone` starts and the next one starts. */
export function dayBounds(ms: number, timeZone: string): { start: number; end: number } {
  const day = dayOf(ms, timeZone);
  const next = new Date(`${day}T12:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: localToUtc(`${day}T00:00`, timeZone), end: localToUtc(`${next.toISOString().slice(0, 10)}T00:00`, timeZone) };
}

/** "14:05" in `timeZone`. */
export const clockTime = (ms: number, timeZone: string): string => utcToLocal(ms, timeZone).slice(11);

/** "Dienstag, 20. Oktober" in `timeZone`, for a day heading. */
export const dayHeading = (ms: number, timeZone: string): string =>
  new Intl.DateTimeFormat("de-DE", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(ms);

/** How long ago, in German: "gerade eben", "vor 5 Min.", "vor 2 Std. 5 Min.", "vor 1 Tag", "vor 3 Tagen". */
export function formatAgo(thenMs: number, nowMs: number): string {
  const minutes = Math.floor(Math.max(0, nowMs - thenMs) / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.${minutes % 60 ? ` ${minutes % 60} Min.` : ""}`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "vor 1 Tag" : `vor ${days} Tagen`;
}

/** formatAgo for a column of times (Start's day at a glance): past an hour only the hours ("vor 23 Std."). */
export function formatAgoShort(thenMs: number, nowMs: number): string {
  const minutes = Math.floor(Math.max(0, nowMs - thenMs) / 60_000);
  return minutes >= 60 && minutes < 24 * 60 ? `vor ${Math.floor(minutes / 60)} Std.` : formatAgo(thenMs, nowMs);
}

/** A running clock for `ms` elapsed: "52:13", "1:02:05". */
export function formatElapsed(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** A duration in German: "52 Min.", "1 Std.", "3 Std. 20 Min.". */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} Min.`;
  return `${Math.floor(min / 60)} Std.${min % 60 ? ` ${min % 60} Min.` : ""}`;
}
