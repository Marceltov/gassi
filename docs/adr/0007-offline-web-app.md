---
status: accepted
date: 2026-10-21
decision-makers: Marcel Bruckner
---

# The web app works offline: queued taps, a kept snapshot and a service worker

## Context and Problem Statement

Gassi is used on the walk, often with one bar or none. ADR 0001 made walk taps commands that wait on the phone; ADR
0006 made the web app one Expo app. What must the web app keep on the device, and what may it need the server for, so
that a running walk survives a reload without reception?

## Decision Drivers

* No lost taps and no second copy of the truth (ADR 0001): the server's database stays the only record.
* A reopened app shows something useful at once, also offline.
* A bad network (one bar, a captive portal) must never hold up opening the app.
* The web app must not serve stale or foreign pages in place of the app.

## Considered Options

* Taps and screens online only
* Queue taps, keep a snapshot of what the server last showed, cache the app shell with a service worker
* A full offline-first store on the device, synced to the server (turned down in ADR 0001)

## Decision Outcome

Chosen option: "queue taps, keep a snapshot, cache the shell".

- **Taps** are commands in a queue per person, from the first tap on (ADR 0001). A refresh sends the queue
  independently of the household's calls and keeps what came back; a late answer after sign-out keeps nothing.
- **Kept on the device** (one seam, `src/data/kept.ts`, `kept.web.ts` in localStorage): the device with its person, the
  last household and sessions the server showed (snapshot) with the last view, the walk ended last (its summary until
  the server knows it) and the food sheet's facts. A running walk survives an offline reload. Signing out, or a 401,
  forgets everything but the queue, which goes out at the same person's next sign-in.
- **Pending taps show at once:** `layerToday` lays pending food and pee/poop over `today`, and `withinWalk` in the
  domain decides "during a walk" for the server and for unsent taps alike (ADR 0002).
- **One web bundle** (`asyncRoutes: false` in the Expo Router plugin): every screen is in the first download, so every
  screen opens offline.
- **A cache-first service worker** (`apps/mobile/public/sw.js`) for the shell only. An app page comes from the kept
  shell at once and is refetched in the background; before a shell is kept, the network answers. It keeps a page only
  when it is the app's own (no redirect, same origin, links an `/_expo/` bundle), together with the bundles it links;
  bundles no shell links go. Hashed files (`/_expo/`, `/assets/`) come from the cache once kept. `/api/*`, `/l/…` and
  `/health` always go to the network and are never kept; foreign pages are refused.
- **Writes other than taps need the server** (Mehr, the walk summary, an entry's detail), through a client with a 10 s
  timeout. No reception or a proxy's 502 to 504 says "Keine Verbindung – bitte später nochmal."; no answer in time says
  "Keine Antwort – ob es gespeichert wurde, ist unklar. Bitte im Verlauf prüfen." (it may have arrived, and trying
  again could save it twice). A training's edit is two calls and can half-save; saving again is safe, since both
  replace what they send.
- **https is needed** for the service worker (and the Clipboard): on a plain-http LAN address the app works, but only
  opens with reception and its copy buttons stay away.

### Consequences

* Good, because a walk can be logged and survives a reload without reception; the queue is sent when it returns.
* Good, because opening never waits for the network once a shell is kept.
* Bad, because the shell can be one version behind until the background refetch has landed.
* Bad, because screens that write more than taps stop with a message offline.
* Bad, because plain-http installations do not open offline.
