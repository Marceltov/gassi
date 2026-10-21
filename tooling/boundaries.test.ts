// The package boundaries are lint rules; these tests make sure the rules are there and bite.
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, test } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const eslint = new ESLint({ cwd: root });
const errors = async (filePath: string, code: string) => (await eslint.lintText(code, { filePath })).flatMap((r) => r.messages.filter((m) => m.ruleId === "no-restricted-imports"));

describe("packages/domain", () => {
  test.each(["node:fs", "react", "next/server", "kysely", "@gassi/server"])("may not import %s", async (mod) => {
    expect(await errors("packages/domain/src/x.ts", `import x from "${mod}";\nexport default x;\n`)).toHaveLength(1);
  });

  test("may import zod", async () => {
    expect(await errors("packages/domain/src/x.ts", `import { z } from "zod";\nexport default z;\n`)).toHaveLength(0);
  });
});

describe("packages/api-client", () => {
  test("may import the domain and zod, nothing from the server", async () => {
    expect(await errors("packages/api-client/src/x.ts", `import { z } from "zod";\nimport { TYPE_LABEL } from "@gassi/domain";\nexport default [z, TYPE_LABEL];\n`)).toHaveLength(0);
    expect(await errors("packages/api-client/src/x.ts", `import x from "@gassi/server";\nexport default x;\n`)).toHaveLength(1);
  });
});
