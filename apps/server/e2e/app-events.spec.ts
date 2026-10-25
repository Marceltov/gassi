// What the app reports to the server (#115): screens, taps and commands arrive in client_event, read from the e2e
// server's database (read-only); a note's text never does.
import Database from "better-sqlite3";
import { expect, test } from "@playwright/test";
import { stopEverything } from "./sessions";
import { signIn } from "./signed-in";

test.beforeEach(stopEverything);
test.afterEach(stopEverything);

type Row = { kind: string; name: string; data: string | null };
const rowsOf = (deviceName: string): Row[] => {
  const db = new Database("test-results/data/gassi.db", { readonly: true });
  try {
    return db.prepare("select e.kind, e.name, e.data from client_event e join device d on d.id = e.device_id where d.name = ? order by e.at").all(deviceName) as Row[];
  } finally {
    db.close();
  }
};

test("screens, taps and commands reach the server's events; a note's text doesn't", async ({ page }) => {
  const name = `Events ${Date.now()} (Web)`;
  await signIn(page, name);
  await page.goto("/verlauf");
  await expect(page.getByTestId("screen-head").filter({ visible: true }).first()).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "Notiz", exact: true }).click();
  const sheet = page.getByTestId("log-sheet");
  await sheet.getByLabel("Notiz").fill("Geheimnis vom Spaziergang");
  await sheet.getByRole("button", { name: "Eintragen" }).click();
  await expect(sheet).toHaveCount(0);
  await page.reload(); // a start refreshes, and the events go with it
  await expect
    .poll(() => rowsOf(name).map((r) => `${r.kind} ${r.name}`), { timeout: 15_000 })
    .toEqual(expect.arrayContaining(["screen /verlauf", "screen /", "tap Eintragen", "command log.entry", "app start"]));
  const all = rowsOf(name);
  expect(JSON.stringify(all)).not.toContain("Geheimnis");
  expect(JSON.parse(all.find((r) => r.name === "log.entry")!.data!)).toEqual({ type: "note" });
});
