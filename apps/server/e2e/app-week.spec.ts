// Woche: this week's totals per person, the 0–24 h strip per day and the week's routes; ‹ › move between weeks. The
// test makes its own walk (the server is shared) and looks only at what that walk must show.
import { addDays, dayOf, mondayOf, utcToLocal } from "@gassi/domain";
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

// The walk starts 3 minutes ago: in the first minutes of a day it would reach back into yesterday's strip.
const minutesIntoDay = () => {
  const [h, m] = utcToLocal(Date.now(), TZ).slice(11).split(":").map(Number);
  return h * 60 + m;
};

test("the week shows the walk just made: one more for Hirsch in the table, one more bar today; ‹ goes to the week before and › back", async ({ page }) => {
  test.skip(minutesIntoDay() < 5, "too close to midnight for a walk of the last minutes");
  const client = asHirsch();
  const today = dayOf(Date.now(), TZ);
  await signIn(page);
  await page.goto("/woche");
  const walks = page.getByTestId("week-Hirsch-walks");
  const bars = page.getByTestId(`strip-${today}`).getByTestId("bar-walk");
  await expect(page.getByTestId(`strip-${today}`)).toBeVisible();
  // Hirsch has no row until he has walked this week
  const countBefore = (await walks.count()) ? Number((await walks.innerText()).split(/\s/)[0]) : 0;
  const barsBefore = await bars.count();

  const key = `week-walk-${Date.now()}`;
  await client.commands({
    commands: [
      { id: `${key}-start`, at: minutesAgo(3), kind: "walk.start", walkKey: key },
      { id: `${key}-stop`, at: minutesAgo(1), kind: "walk.stop", walkKey: key },
    ],
  });
  made.push((await client.walkByKey({ key })).summary.id);

  await page.reload();
  await expect(walks).toHaveText(new RegExp(`^${countBefore + 1} · `));
  await expect(bars).toHaveCount(barsBefore + 1);
  const heading = await page.getByTestId("week-heading").innerText();

  await page.getByRole("button", { name: "Vorherige Woche" }).click();
  await expect(page.getByTestId("week-heading")).not.toHaveText(heading);
  await expect(page.getByTestId(`strip-${addDays(mondayOf(Date.now(), TZ), -7)}`)).toBeVisible();
  await expect(page.getByTestId(`strip-${today}`)).toHaveCount(0);

  await page.getByRole("button", { name: "Nächste Woche" }).click();
  await expect(page.getByTestId("week-heading")).toHaveText(heading);
  await expect(bars).toHaveCount(barsBefore + 1);
  await expect(page.getByRole("button", { name: "Nächste Woche" })).toBeDisabled();
});
