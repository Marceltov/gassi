import { describe, expect, it } from "vitest";
import { buildsThisMonth } from "../scripts/eas-month.mjs";

describe("buildsThisMonth", () => {
  it("counts the builds started in the current month (UTC), whatever their state", () => {
    const builds = [
      { createdAt: "2026-10-25T12:00:00.000Z", status: "FINISHED" },
      { createdAt: "2026-10-01T00:00:01.000Z", status: "ERRORED" },
      { createdAt: "2026-09-30T23:59:59.000Z", status: "FINISHED" },
      { createdAt: "2025-10-25T12:00:00.000Z", status: "FINISHED" },
    ];
    expect(buildsThisMonth(builds, new Date("2026-10-25T13:00:00Z"))).toBe(2);
    expect(buildsThisMonth([], new Date("2026-10-25T13:00:00Z"))).toBe(0);
  });
});
