---
status: accepted
date: 2026-10-22
decision-makers: Marcel Bruckner
---

# Every screen has one address, under its tab

## Context and Problem Statement

An entry and a walk's summary were shared routes: `/eintrag/<id>` and `/runde/<id>` existed in the Start, Verlauf and
Mehr tabs, each a one-line route file pointing to the same screen. Expo Router (58) chooses between such copies with
a sort that isn't a consistent order, so the result depends on the order the bundler lists the route files: of 60
random orders of the same files, a walk opened from Verlauf landed in Start 10 times, and a reload of `/eintrag/5`
opened in any of the three tabs (#53). Adding or removing any route file could flip it, which is how #44 and #60
tripped `app-history.spec.ts`. Links should also be stable to share.

## Considered Options

* Name the tab's group in every link (`/(tabs)/(chronik)/runde/5`): fixes taps in the app, not a link or a reload
* One route file for several tabs with Expo Router's `(chronik,start)` folders: expands to the same copies, same sort
* One address per screen, under its tab

## Decision Outcome

Chosen option: "one address per screen, under its tab". Verlauf's screens live under `/verlauf` (`/verlauf/eintrag/5`,
`/verlauf/runde/5`), Mehr's under `/mehr` (`/mehr/eintrag/5`), Start's at the top (`/runde/<key or id>`, `/eintrag/5`).
No two tabs share an address, so a link or a reload always opens the same tab. A screen shown in several tabs links on
within its tab through `src/ui/tabPath.ts`. The old shared addresses are gone without redirects (the guidelines' no
compatibility rule).

### Consequences

* Good, because links are stable to share and the tab no longer depends on the bundler.
* Good, because Verlauf no longer needs its redirect for walk keys to Start.
* Bad, because each tab still has a one-line route file for the screens it shows; that is the router's way to put a
  screen in a tab, not a copy of an address.

### Confirmation

`app-tabs.spec.ts` opens and reloads each address and checks its tab; running Expo Router's own matching over 60
random orders of the route files gives one tab for each address.
