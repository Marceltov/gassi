import { describe, expect, test } from "vitest";
import { addMonths, monthGrid, monthLabel, monthOf, noonOf } from "./month";
import { localToUtc } from "./time";
import { kgToGrams, weightChange, weightsByDay } from "./weight";

const TZ = "Europe/Berlin";

describe("month", () => {
  test("the month of an instant is the local one", () => {
    expect(monthOf(Date.parse("2026-10-31T23:30:00Z"), TZ)).toBe("2026-11"); // 00:30 on 1 November in Berlin
    expect(monthOf(Date.parse("2026-10-31T21:00:00Z"), TZ)).toBe("2026-10");
  });

  test("months step across years", () => {
    expect(addMonths("2026-10", 1)).toBe("2026-11");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  test("a month reads in German", () => {
    expect(monthLabel("2026-10")).toBe("Oktober 2026");
    expect(monthLabel("2027-03")).toBe("März 2027");
  });

  test("the grid is whole weeks from Monday, with the neighbours' days marked", () => {
    const weeks = monthGrid("2026-10"); // 1 October 2026 is a Thursday, 31 a Saturday
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0].map((d) => d.date)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(weeks[0].map((d) => d.inMonth)).toEqual([false, false, false, true, true, true, true]);
    expect(weeks[4].at(-1)).toEqual({ date: "2026-11-01", inMonth: false });
    expect(monthGrid("2027-02")).toHaveLength(4); // February 2027 starts on a Monday and has 28 days
  });

  test("a day's weight goes in at noon, local time", () => {
    expect(noonOf("2026-10-08", TZ)).toBe(new Date(localToUtc("2026-10-08T12:00", TZ)).toISOString());
  });
});

describe("weight", () => {
  test("kg typed loosely become grams to the 100 g; outside 0,5–100 kg or not a number is null", () => {
    expect(kgToGrams("12,46")).toBe(12_500);
    expect(kgToGrams(" 7 ")).toBe(7000);
    expect(kgToGrams("0,4")).toBeNull();
    expect(kgToGrams("zwölf")).toBeNull();
    expect(kgToGrams("")).toBeNull();
  });

  const w = (id: number, at: string, amountG: number) => ({ id, at, amountG });

  test("each day has its newest weight", () => {
    const days = weightsByDay([w(3, "2026-10-15T18:00:00Z", 9000), w(2, "2026-10-15T07:00:00Z", 8800), w(1, "2026-10-01T10:00:00Z", 6000)], TZ);
    expect(days.get("2026-10-15")?.id).toBe(3);
    expect(days.get("2026-10-01")?.amountG).toBe(6000);
    expect(days.size).toBe(2);
  });

  test("the change is the newest against the one before it", () => {
    expect(weightChange([w(2, "2026-10-22T10:00:00Z", 7000), w(1, "2026-10-15T10:00:00Z", 9000)], TZ)).toBe("−2,0 kg seit 15.10.");
    expect(weightChange([w(2, "2026-10-22T10:00:00Z", 9300), w(1, "2026-10-15T10:00:00Z", 9000)], TZ)).toBe("+0,3 kg seit 15.10.");
    expect(weightChange([w(2, "2026-10-22T10:00:00Z", 9000), w(1, "2026-10-15T10:00:00Z", 9000)], TZ)).toBe("gleich seit 15.10.");
    expect(weightChange([w(1, "2026-10-15T10:00:00Z", 9000)], TZ)).toBeNull();
  });
});
