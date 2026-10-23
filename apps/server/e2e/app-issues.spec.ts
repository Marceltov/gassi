// Wünsche und Fehler (#45, #39): without GitHub set up, Mehr has no row for it. With it (the server's answers made up
// here, so no test talks to GitHub), the row counts what is open, the page lists open then closed, filters, opens an
// issue on GitHub, and the form files a wish that then shows on top.
import { expect, type Page, test } from "@playwright/test";
import { expectFits } from "./fit";
import { signIn } from "./signed-in";

const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
const issue = (number: number, title: string, more: object = {}) => ({ number, title, open: true, kind: "wish", fromApp: false, at: at(3), url: `https://github.com/Marceltov/gassi/issues/${number}`, ...more });

/** The server as if GitHub were set up: me says so, and /api/issues lists `issues` and files a report on top of them. */
async function withGitHub(page: Page, issues: ReturnType<typeof issue>[]) {
  const sent: unknown[] = [];
  await page.route("**/api/me", async (route) => {
    const res = await route.fetch();
    const me = (await res.json()) as { household: object };
    await route.fulfill({ response: res, json: { ...me, household: { ...me.household, issues: true } } });
  });
  await page.route("**/api/issues", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { kind: "wish" | "bug"; title: string };
      sent.push(body);
      const filed = issue(99, body.title, { kind: body.kind, fromApp: true, at: at(0) });
      issues.unshift(filed);
      return route.fulfill({ json: filed });
    }
    return route.fulfill({ json: { issues } });
  });
  await page.route("https://github.com/**", (route) => route.fulfill({ body: "GitHub" }));
  return sent;
}

test("without GitHub set up, Mehr has no Wünsche und Fehler", async ({ page }) => {
  await signIn(page);
  await page.goto("/mehr");
  await expect(page.getByTestId("more-Quellcode")).toBeVisible();
  await expect(page.getByTestId("more-Wuensche")).toHaveCount(0);
});

test("Wünsche und Fehler: open then closed, a filter, a tap opens GitHub, and a wish sent shows on top", async ({ page }) => {
  await signIn(page);
  const sent = await withGitHub(page, [issue(86, "Pick the Konsistenz"), issue(84, "Leckerli-Zähler springt", { kind: "bug", fromApp: true }), issue(83, "A tile for the last training", { open: false, kind: null, at: at(1) })]);
  await page.goto("/mehr");
  await expect(page.getByTestId("more-Wuensche")).toContainText("2 offen");
  await page.getByTestId("more-Wuensche").click();

  await expect(page.getByText("Offen", { exact: true })).toBeVisible();
  await expect(page.getByTestId("issue-84")).toContainText("Fehler");
  await expect(page.getByTestId("issue-84")).toContainText("aus der App");
  await expect(page.getByTestId("issue-83")).toContainText("#83 · erledigt gestern");

  await page.getByLabel("Suchen").fill("konsistenz");
  await expect(page.getByTestId("issue-86")).toBeVisible();
  await expect(page.getByTestId("issue-84")).toHaveCount(0);
  await page.getByLabel("Suchen").fill("#83");
  await expect(page.getByTestId("issue-83")).toBeVisible();
  await expect(page.getByTestId("issue-86")).toHaveCount(0);

  const popup = page.waitForEvent("popup");
  await page.getByTestId("issue-83").click();
  expect((await popup).url()).toBe("https://github.com/Marceltov/gassi/issues/83");

  await page.getByRole("button", { name: "Wunsch oder Fehler melden" }).click();
  const sheet = page.getByTestId("report-sheet");
  await expect(sheet.getByRole("button", { name: "Senden" })).toBeDisabled();
  await sheet.getByRole("tab", { name: "Fehler" }).click();
  await sheet.getByLabel("Worum geht es?").fill("Karte bleibt grau");
  await sheet.getByLabel("Was ist passiert?").fill("Nach der Runde");
  await sheet.getByRole("button", { name: "Senden" }).click();
  await expect(sheet).toHaveCount(0);
  expect(sent).toEqual([{ kind: "bug", title: "Karte bleibt grau", text: "Nach der Runde", version: "0.3.0" }]);
  await expect(page.getByTestId("issue-99")).toContainText("#99 · heute");
  await expect(page.getByLabel("Suchen")).toHaveValue("");
});

test("Wünsche und Fehler fits a small and a big phone", async ({ page }) => {
  await signIn(page);
  await withGitHub(page, Array.from({ length: 12 }, (_, i) => issue(i + 1, `Wunsch ${i + 1}`)));
  await expectFits(page, "/mehr/wuensche", "Wunsch 1");
});
