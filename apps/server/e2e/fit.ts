// Pages fit the screen (#71): at a small and a big phone a page's title (`head`) and its buttons below (`bottom`) stay
// on screen; only the content between them (`top`) may scroll, nothing else does, and a page that fills the height
// (`fill`) cuts nothing off. Text
// fields are at least 16 px: an iPhone zooms into a smaller one when it gets the focus.
import { expect, type Page } from "@playwright/test";

export const PHONES = [
  [360, 640],
  [430, 932],
] as const;

/** Opens `path` at each phone size, waits for `ready` (a text the page shows once loaded) and checks it fits. */
export async function expectFits(page: Page, path: string, ready: string | RegExp) {
  for (const [width, height] of PHONES) {
    await page.setViewportSize({ width, height });
    await page.goto(path);
    await expect(page.getByText(ready).filter({ visible: true }).first()).toBeVisible();
    const found = await page.evaluate(() => {
      const all = [...document.querySelectorAll<HTMLElement>("*")];
      const inTop = (e: Element) => !!e.closest('[data-testid="screen-scroll"]');
      const scrolling = all
        .filter((e) => e.scrollHeight > e.clientHeight + 1 && ["auto", "scroll"].includes(getComputedStyle(e).overflowY))
        .map((e) => e.dataset.testid ?? e.tagName)
        .filter((id) => id !== "screen-scroll");
      const fills = [...document.querySelectorAll<HTMLElement>('[data-testid="screen-fill"]')].filter((e) => e.offsetParent !== null);
      const cut = Math.max(0, ...fills.map((e) => e.scrollHeight - e.clientHeight - 1));
      const off = all
        .filter((e) => e.getAttribute("role") === "button" && e.offsetParent !== null && !inTop(e) && !e.closest('[aria-modal="true"]'))
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.top < 0 || r.bottom > innerHeight + 1;
        })
        .map((e) => e.getAttribute("aria-label") ?? e.textContent);
      const small = all
        // text fields only: a switch's checkbox takes no typing, so the iPhone doesn't zoom into it
        .filter((e) => (e.tagName === "TEXTAREA" || (e.tagName === "INPUT" && !["checkbox", "radio"].includes((e as HTMLInputElement).type))) && e.offsetParent !== null && parseFloat(getComputedStyle(e).fontSize) < 16)
        .map((e) => e.getAttribute("aria-label") ?? e.tagName);
      const heads = [...document.querySelectorAll<HTMLElement>('[data-testid="screen-head"]')].filter((e) => e.offsetParent !== null);
      for (const h of heads) if (h.getBoundingClientRect().top < 0) off.push(h.textContent);
      return { scrolling, cut, off, small };
    });
    expect(found, `${path} at ${width}×${height}`).toEqual({ scrolling: [], cut: 0, off: [], small: [] });
  }
}
