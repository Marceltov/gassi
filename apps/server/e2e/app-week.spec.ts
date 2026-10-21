// Woche: this week's totals per person, the 0–24 h strip per day and the week's routes; ‹ › move between weeks. The
// test makes its own walk (the server is shared) and looks only at what that walk must show.
import { addDays, dayOf, mondayOf } from "@gassi/domain";
import { expect, test } from "@playwright/test";
import { asHirsch, stopEverything } from "./sessions";
import { signIn } from "./signed-in";

test.beforeEach(stopEverything);
test.afterEach(stopEverything);

const made: number[] = [];
test.afterEach(async () => {
  for (const id of made.splice(0)) await asHirsch().deleteEntry({ id }).catch(() => undefined);
});

const TZ = "Europe/Berlin";
// whole minutes, so the walk ends before now and lies in today
const minutesAgo = (n: number) => new Date(Math.floor(Date.now() / 60_000) * 60_000 - n * 60_000).toISOString();

test("the week shows Hirsch's walk in the table and as a bar today; ‹ goes to the week before and › back", async ({ page }) => {
  const client = asHirsch();
  const key = `week-walk-${Date.now()}`;
  await client.commands({
    commands: [
      { id: `${key}-start`, at: minutesAgo(3), kind: "walk.start", walkKey: key },
      { id: `${key}-stop`, at: minutesAgo(1), kind: "walk.stop", walkKey: key },
    ],
  });
  made.push((await client.walkByKey({ key })).summary.id);

  const today = dayOf(Date.now(), TZ);
  await signIn(page);
  await page.goto("/woche");
  const walks = page.getByTestId("week-Hirsch-walks");
  await expect(walks).toBeVisible();
  expect(Number((await walks.innerText()).split(/\s/)[0])).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId(`strip-${today}`).getByTestId("bar-walk").first()).toBeVisible();
  const heading = await page.getByTestId("week-heading").innerText();

  await page.getByRole("button", { name: "Vorherige Woche" }).click();
  await expect(page.getByTestId("week-heading")).not.toHaveText(heading);
  await expect(page.getByTestId(`strip-${addDays(mondayOf(Date.now(), TZ), -7)}`)).toBeVisible();
  await expect(page.getByTestId(`strip-${today}`)).toHaveCount(0);

  await page.getByRole("button", { name: "Nächste Woche" }).click();
  await expect(page.getByTestId("week-heading")).toHaveText(heading);
  await expect(page.getByTestId(`strip-${today}`).getByTestId("bar-walk").first()).toBeVisible();
});
