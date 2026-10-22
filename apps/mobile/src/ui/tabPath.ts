// Every screen has one address, under the tab it is in: an entry opened from Verlauf is /verlauf/eintrag/5, from a walk's
// summary on Start /eintrag/5. So a link or a reload always opens the same tab (#53: when
// two tabs shared an address, Expo Router chose between them by the order of its files). A screen shown in several
// tabs (the entry, a walk's summary) links on with this, in the tab it is shown in.
import { type Href, useSegments } from "expo-router";

/** Where each tab's own screens live; Start's are at the top. */
const BASE: Record<string, string> = { "(chronik)": "/verlauf", "(mehr)": "/mehr", "(start)": "" };

/** `path` ("/eintrag/5") under the tab shown now: "/verlauf/eintrag/5" on Verlauf. */
export function useTabPath(): (path: `/${string}`) => Href {
  const tab = (useSegments() as string[])[1] ?? "";
  return (path) => `${BASE[tab] ?? ""}${path}` as Href;
}
