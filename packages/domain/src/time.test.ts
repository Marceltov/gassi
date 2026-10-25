import { describe, expect, test } from "vitest";
import { clockTime, dayBounds, dayOf, formatAgo, formatAgoShort, formatElapsed, formatMinutes, isLocalDateTime, localToUtc, utcToLocal } from "./time";

const TZ = "Europe/Berlin";
const at = (iso: string) => Date.parse(iso);

describe("localToUtc and utcToLocal", () => {
  test("summer time is UTC+2, winter time UTC+1", () => {
    expect(new Date(localToUtc("2026-07-01T14:05", TZ)).toISOString()).toBe("2026-07-01T12:05:00.000Z");
    expect(new Date(localToUtc("2026-12-01T14:05", TZ)).toISOString()).toBe("2026-12-01T13:05:00.000Z");
  });

  test("round-trips", () => {
    for (const iso of ["2026-03-29T00:30:00Z", "2026-10-25T01:30:00Z", "2026-06-15T22:59:00Z"]) {
      expect(localToUtc(utcToLocal(at(iso), TZ), TZ)).toBe(at(iso));
    }
  });

  test("the hour that repeats when summer time ends resolves to its second pass", () => {
    expect(new Date(localToUtc("2026-10-25T02:30", TZ)).toISOString()).toBe("2026-10-25T01:30:00.000Z");
  });

  test("rejects anything that isn't a local date-time", () => {
    expect(() => localToUtc("2026-07-01 14:05", TZ)).toThrow();
  });

  test("a day or time that doesn't exist is no local date-time, and doesn't roll over into another", () => {
    expect(isLocalDateTime("2026-10-20T14:05")).toBe(true);
    expect(isLocalDateTime("2028-02-29T00:00")).toBe(true);
    for (const t of ["2026-02-31T10:00", "2026-13-01T10:00", "2026-10-00T10:00", "2026-10-20T24:00", "2026-10-20T14:60", "2026-10-20T14:5"]) {
      expect(isLocalDateTime(t), t).toBe(false);
    }
    expect(() => localToUtc("2026-02-31T25:99", TZ)).toThrow();
  });
});

describe("dayOf and dayBounds", () => {
  test("late evening UTC is already tomorrow in Berlin", () => {
    expect(dayOf(at("2026-10-20T22:30:00Z"), TZ)).toBe("2026-10-21");
    expect(dayOf(at("2026-10-20T21:59:00Z"), TZ)).toBe("2026-10-20");
  });

  test("a day runs from local midnight to local midnight", () => {
    const { start, end } = dayBounds(at("2026-10-20T10:00:00Z"), TZ);
    expect(new Date(start).toISOString()).toBe("2026-10-19T22:00:00.000Z");
    expect(new Date(end).toISOString()).toBe("2026-10-20T22:00:00.000Z");
  });

  test("the day summer time ends has 25 hours", () => {
    const { start, end } = dayBounds(at("2026-10-25T10:00:00Z"), TZ);
    expect((end - start) / 3_600_000).toBe(25);
  });
});

test("clockTime shows the local time", () => {
  expect(clockTime(at("2026-10-20T12:05:00Z"), TZ)).toBe("14:05");
});

describe("formatAgo", () => {
  const now = at("2026-10-20T12:00:00Z");
  test.each([
    [0, "gerade eben"],
    [59, "gerade eben"],
    [60, "vor 1 Min."],
    [59 * 60, "vor 59 Min."],
    [2 * 3600, "vor 2 Std."],
    [2 * 3600 + 5 * 60, "vor 2 Std. 5 Min."],
    [24 * 3600, "vor 1 Tag"],
    [3 * 24 * 3600, "vor 3 Tagen"],
  ])("%i s ago is %j", (seconds, text) => {
    expect(formatAgo(now - seconds * 1000, now)).toBe(text);
  });

  test("a time in the future reads as just now", () => {
    expect(formatAgo(now + 60_000, now)).toBe("gerade eben");
  });
});

test("formatElapsed shows a running clock: m:ss below an hour, then h:mm:ss", () => {
  expect(formatElapsed(0)).toBe("0:00");
  expect(formatElapsed(52 * 60_000 + 13_000)).toBe("52:13");
  expect(formatElapsed(62 * 60_000 + 5_000)).toBe("1:02:05");
  expect(formatElapsed(-5_000)).toBe("0:00");
});

test("formatMinutes: Min. below an hour, then Std. and Min.", () => {
  expect(formatMinutes(0)).toBe("0 Min.");
  expect(formatMinutes(52)).toBe("52 Min.");
  expect(formatMinutes(60)).toBe("1 Std.");
  expect(formatMinutes(200)).toBe("3 Std. 20 Min.");
});

test("formatAgoShort: past an hour only the hours, as a list of times reads; else as formatAgo", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  const ago = (min: number) => formatAgoShort(now - min * 60_000, now);
  expect(ago(0)).toBe("gerade eben");
  expect(ago(25)).toBe("vor 25 Min.");
  expect(ago(61)).toBe("vor 1 Std.");
  expect(ago(23 * 60 + 48)).toBe("vor 23 Std.");
  expect(ago(26 * 60)).toBe("vor 1 Tag");
  expect(ago(50 * 60)).toBe("vor 2 Tagen");
});
