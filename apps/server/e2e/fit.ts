// Pages fit the screen (#71): at a small and a big phone nothing scrolls but the part a page names (its list), nothing
// is cut off at the bottom of a page that fills the height, and every button outside that list is on screen. Text
// fields are at least 16 px: an iPhone zooms into a smaller one when it gets the focus.
import { expect, type Page } from "@playwright/test";

export const PHONES = [
  [360, 640],
  [430, 932],
] as const;

/** Opens `path` at each phone size, waits for `ready` (a text the page shows once loaded) and checks it fits. */
export async function expectFits(page: Page, path: string, ready: string | RegExp, { scrolls }: { scrolls?: string } = {}) {
  for (const [width, height] of PHONES) {
    await page.setViewportSize({ width, height });
    await page.goto(path);
    await expect(page.getByText(ready).filter({ visible: true }).first()).toBeVisible();
    const found = await page.evaluate((allowed) => {
      const all = [...document.querySelectorAll<HTMLElement>("*")];
      const inAllowed = (e: Element) => !!allowed && !!e.closest(`[data-testid="${allowed}"]`);
      const scrolling = all
        .filter((e) => e.scrollHeight > e.clientHeight + 1 && ["auto", "scroll"].includes(getComputedStyle(e).overflowY))
        .map((e) => e.dataset.testid ?? e.tagName)
        .filter((id) => id !== allowed);
      const fills = [...document.querySelectorAll<HTMLElement>('[data-testid="screen-fill"]')].filter((e) => e.offsetParent !== null);
      const cut = Math.max(0, ...fills.map((e) => e.scrollHeight - e.clientHeight - 1));
      const off = all
        .filter((e) => e.getAttribute("role") === "button" && e.offsetParent !== null && !inAllowed(e) && !e.closest('[aria-modal="true"]'))
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.top < 0 || r.bottom > innerHeight + 1;
        })
        .map((e) => e.getAttribute("aria-label") ?? e.textContent);
      const small = all
        .filter((e) => ["INPUT", "TEXTAREA"].includes(e.tagName) && e.offsetParent !== null && parseFloat(getComputedStyle(e).fontSize) < 16)
        .map((e) => e.getAttribute("aria-label") ?? e.tagName);
      return { scrolling, cut, off, small };
    }, scrolls ?? null);
    expect(found, `${path} at ${width}×${height}`).toEqual({ scrolling: [], cut: 0, off: [], small: [] });
  }
}
