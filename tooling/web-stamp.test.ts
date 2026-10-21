import { describe, expect, it } from "vitest";
import { exportStamp, needsExport } from "../scripts/web-stamp.mjs";

const files = [
  { path: "apps/mobile/src/a.ts", hash: "1" },
  { path: "packages/domain/src/b.ts", hash: "2" },
];

describe("exportStamp", () => {
  it("does not depend on the order of the files or of the variables", () => {
    expect(exportStamp([...files].reverse(), { EXPO_PUBLIC_A: "1", EXPO_PUBLIC_B: "2" })).toBe(
      exportStamp(files, { EXPO_PUBLIC_B: "2", EXPO_PUBLIC_A: "1" }),
    );
  });

  it("changes with a file's content, a new file or an EXPO_PUBLIC_ variable", () => {
    const base = exportStamp(files, {});
    expect(exportStamp([{ ...files[0], hash: "x" }, files[1]], {})).not.toBe(base);
    expect(exportStamp([...files, { path: "apps/mobile/src/c.ts", hash: "3" }], {})).not.toBe(base);
    expect(exportStamp(files, { EXPO_PUBLIC_API: "http://x" })).not.toBe(base);
  });

  it("changes with the installed packages or a package's manifest", () => {
    const base = exportStamp(files, {});
    expect(exportStamp([...files, { path: "node_modules/.package-lock.json", hash: "a" }], {})).not.toBe(base);
    expect(exportStamp([...files, { path: "packages/domain/package.json", hash: "a" }], {})).not.toBe(base);
  });

  it("ignores other variables", () => {
    expect(exportStamp(files, { PATH: "/bin", CORS_ORIGIN: "x" })).toBe(exportStamp(files, {}));
  });
});

describe("needsExport", () => {
  const base = { stamp: "s", stored: "s", exported: true, force: false };
  it("skips when nothing changed", () => expect(needsExport(base)).toBe(false));
  it("exports when the stamp differs", () => expect(needsExport({ ...base, stored: "old" })).toBe(true));
  it("exports when there is no stamp or no export", () => {
    expect(needsExport({ ...base, stored: undefined })).toBe(true);
    expect(needsExport({ ...base, exported: false })).toBe(true);
  });
  it("exports when forced", () => expect(needsExport({ ...base, force: true })).toBe(true));
});
