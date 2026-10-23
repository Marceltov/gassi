// Woche: this week's totals per person, the 0–24 h strip per day and the week's routes; ‹ › move between weeks. The
// test makes its own walk (the server is shared) and looks only at what that walk must show.
import { addDays, dayOf, mondayOf, utcToLocal } from "@gassi/domain";
import { expect, test } from "@playwright/test";
import { expectFits } from "./fit";
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

  // ← and → on a keyboard, and a swipe sideways, do the same
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("week-heading")).not.toHaveText(heading);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("week-heading")).toHaveText(heading);
  await page.keyboard.press("ArrowRight"); // no week after this one
  await expect(page.getByTestId("week-heading")).toHaveText(heading);
  const swipe = async (dx: number) => {
    const box = (await page.getByTestId(/^strip-/).first().boundingBox())!; // the days, not the map
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) await page.mouse.move(x + (dx * i) / 5, y);
    await page.mouse.up();
  };
  await swipe(120); // to the right: the week before
  await expect(page.getByTestId("week-heading")).not.toHaveText(heading);
  await swipe(-120); // to the left: the week after
  await expect(page.getByTestId("week-heading")).toHaveText(heading);
});

test("Woche fits a small and a big phone: the week and its arrows stay on top, the map takes the height that is left", async ({ page }) => {
  test.skip(minutesIntoDay() < 5, "too close to midnight for a walk of the last minutes");
  const client = asHirsch();
  const key = `week-map-${Date.now()}`;
  await client.commands({
    commands: [
      { id: `${key}-start`, at: minutesAgo(3), kind: "walk.start", walkKey: key },
      { id: `${key}-stop`, at: minutesAgo(1), kind: "walk.stop", walkKey: key },
    ],
  });
  const walk = (await client.walkByKey({ key })).summary;
  made.push(walk.id);
  const t = (s: number) => new Date(Date.parse(walk.startedAt) + s * 1000).toISOString();
  const points = [0, 600, 1200].map((north, i) => ({ t: t(i), lat: 48.137 + north / 111_195, lon: 11.575, ele: null, acc: 5 }));
  await client.uploadTrack({ trackId: `walk-${key}`, walkKey: key, source: "phone", seq: 0, points });

  await signIn(page);
  await expectFits(page, "/woche", "Runden · Zeit");
  await expect(page.getByTestId("screen-head").getByTestId("week-heading")).toBeVisible();
  await expect(page.getByTestId("screen-head").getByRole("button", { name: "Vorherige Woche" })).toHaveCSS("height", "44px");
  // at the big phone (the last one checked) the map reaches down to the tab bar, keeping the gutter
  const [map, scroll] = await Promise.all([page.getByTestId("track-map").boundingBox(), page.getByTestId("screen-scroll").boundingBox()]);
  expect(Math.round(scroll!.y + scroll!.height - (map!.y + map!.height))).toBe(Math.round(map!.x)); // the gutter
  expect(map!.height).toBeGreaterThan(200);
});
