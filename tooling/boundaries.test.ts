// The package boundaries are lint rules; these tests make sure the rules are there and bite.
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, test } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const eslint = new ESLint({ cwd: root });
// The first lint of a run loads the config and every plugin: more than vitest's 5 s when the machine is busy.
const SLOW = { timeout: 20_000 };
const errors = async (filePath: string, code: string) => (await eslint.lintText(code, { filePath })).flatMap((r) => r.messages.filter((m) => m.ruleId === "no-restricted-imports"));

describe("packages/domain", SLOW, () => {
  test.each(["node:fs", "react", "next/server", "kysely", "@gassi/server"])("may not import %s", async (mod) => {
    expect(await errors("packages/domain/src/x.ts", `import x from "${mod}";\nexport default x;\n`)).toHaveLength(1);
  });

  test("may import zod", async () => {
    expect(await errors("packages/domain/src/x.ts", `import { z } from "zod";\nexport default z;\n`)).toHaveLength(0);
  });
});

describe("packages/api-client", SLOW, () => {
  test("may import the domain and zod, nothing from the server", async () => {
    expect(await errors("packages/api-client/src/x.ts", `import { z } from "zod";\nimport { TYPE_LABEL } from "@gassi/domain";\nexport default [z, TYPE_LABEL];\n`)).toHaveLength(0);
    expect(await errors("packages/api-client/src/x.ts", `import x from "@gassi/server";\nexport default x;\n`)).toHaveLength(1);
  });
});

describe("apps/mobile", SLOW, () => {
  test.each(["@gassi/server", "@gassi/server/backend", "../../server/backend", "../../../apps/server/app/layout", "next/link"])("may not import %s", async (mod) => {
    expect(await errors("apps/mobile/app/x.tsx", `import x from "${mod}";\nexport default x;\n`)).toHaveLength(1);
  });

  test("may import the API client, the domain and Expo", async () => {
    expect(await errors("apps/mobile/app/x.tsx", `import { createClient } from "@gassi/api-client";\nimport { TYPE_LABEL } from "@gassi/domain";\nimport { Tabs } from "expo-router";\nexport default [createClient, TYPE_LABEL, Tabs];\n`)).toHaveLength(0);
  });
});
