---
status: accepted
date: 2026-10-25
decision-makers: Marcel Bruckner
---

# The app reports what happens in it to the household's own server

## Context and Problem Statement

Bille's phone rejected every server answer for a day (#106) and nobody could see it: the app had no way to say what
went wrong, and nobody knew how often she synced, which screens she used or whether her route arrived. Marcel wants
error traces and usage statistics (#115). Gassi is self-hosted, and the updates already avoid any third-party cloud
(Android design, step 3).

## Considered Options

* A hosted service (Sentry, PostHog, Expo Insights)
* Errors only, as log lines (what #106 built)
* One event stream to the household's own server, errors included, kept in a table for a while

## Decision Outcome

Chosen: **one event stream to the household's own server**. The data stays where the diary is, and it can be queried.

* **What:** errors (sync, crashes, render errors, the background recording) with message and stack; screens opened
  (the address); taps and holds on the big buttons (their names); every command by kind (pee or poop, worked or not);
  each call to the server with its time, result and the queue's length; refused taps; offline and back; the route's
  status and batches; app start, foreground, background.
* **Never:** notes, encounter details, typed names, the device token, positions (the route already reaches the
  server through the track upload). `data/usage.ts` shapes what a command says, and its tests check it.
* **On the phone:** kept in storage (the newest 2000), sent every 30 s in batches of 100, the same error once a minute;
  a batch the server refuses is dropped, so a bad event can't block the stream as the queue did in #106. A sign-out
  forgets them.
* **On the server:** `client_event`, one row per event and device (resent batches store nothing twice), kept 30 days;
  errors are also a `client-error` log line each. `CLIENT_EVENTS=all|errors|off` (default all) says what is kept, and
  the answer tells the app, which then records only that (and asks again hourly while it has nothing to send).

### Consequences

* Good: errors show up without the phone at hand; usage and sync health can be counted per device and day.
* Good: no third party; another household's server keeps its own, and can turn it off.
* Bad: stacks arrive minified (web) or as Hermes bundle offsets (Android) until source maps are kept (a later issue).
* Bad: the background task's events wait until the app opens; a page closed for good loses what it hadn't sent.

## Reading them

On the homelab, read-only, against the live database or a backup copy (the host has Python, not the sqlite3 tool):

```bash
cd /root/services/gassi
q() { python3 -I -c 'import sqlite3, sys
db = sqlite3.connect("file:data/gassi.db?mode=ro", uri=True)
for row in db.execute(sys.argv[1]): print(*row, sep=" | ")' "$1"; }
# Bille's errors this week
q "select e.at, e.name, json_extract(e.data, '$.message') from client_event e join person p on p.id = e.person_id
   where p.name = 'Herzii' and e.kind = 'error' and e.at > date('now', '-7 days') order by e.at"
# failed syncs per day and device
q "select substr(e.at, 1, 10), d.name, count(*) from client_event e join device d on d.id = e.device_id
   where e.kind = 'sync' and json_extract(e.data, '$.ok') = 0 group by 1, 2 order by 1"
```
