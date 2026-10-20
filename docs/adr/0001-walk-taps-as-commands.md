---
status: accepted
date: 2026-10-20
decision-makers: Marcel Bruckner
---

# Walk and training taps are commands with client ids and their own time

## Context and Problem Statement

From v1.1 a walk runs from the front door to home, and everything on the walk and training screens (start, Pipi,
Poopoo, Pause/Weiter, Training, exercises, "+1" treat, Zuhause, Mitgehen) has to survive a phone without reception:
taps are kept on the phone and sent later, nothing gets lost. At the same time the database must stay the only truth
for the walk, so both phones show the same walk once they are online. How do the screens talk to the server?

## Decision Drivers

* No lost taps without reception; a retry after a timeout must not log twice.
* No second copy of a running walk in the browser (spec anti-goal).
* Two phones can tap on the same walk; taps arrive late and out of order.
* Same stack as v1 (Next.js server actions, SQLite), no new runtime dependency.

## Considered Options

* Server actions per tap, as for v1's one-tap logging
* Commands with a client id and the tap's time, sent in batches to one route and applied idempotently
* A local copy of the walk in the browser, synced to the server (offline-first store)

## Decision Outcome

Chosen option: "Commands with a client id and the tap's time", because it is the only option that loses nothing
offline, cannot double-log on a resend, and still keeps the walk on the server only.

`POST /api/commands` takes `{ commands }` for the signed-in person (JSON only, at most 100) and answers which ids it
applied or dropped plus the walk/training as they are now. `backend/sessions.ts` applies commands in tap-time order,
each in its own transaction, recording every id in `applied_command`; an id seen before is not applied again. Late
taps follow fixed rules: pee/poop always become entries at their time; pause, resume, join and training taps at or
after the end of their walk/training are dropped; a second start while a walk runs joins it (its key becomes an alias,
`session_alias`). The phone keeps unsent commands per person in `localStorage` and shows the server's view with them
laid over (`shared/sessionProjection.ts`); a command leaves the queue only once the server listed it.

### Consequences

* Good, because taps queued for an hour in a forest arrive with their real times and land where they belong.
* Good, because resending is always safe, so the queue can simply retry (on `online`, every 15 s, on each tap).
* Bad, because the projection duplicates the rules in a simplified form for display; the server's answer wins.
* Bad, because the server-side rules for late taps are more code than a plain insert and need their own tests.

### Confirmation

`backend/sessions.test.ts` (late pause dropped, late pipi kept, duplicate ids, time order, second start joins),
`components/commandQueue.test.ts`, and the e2e spec "taps without reception wait on the phone and are sent later".

## Pros and Cons of the Options

### Server actions per tap

* Good, because it is what v1 does.
* Bad, because a server action needs the network at the moment of the tap; offline taps would be lost or need a
  queue anyway, and a retried action would log twice.

### Local copy of the walk, synced

* Good, because the screen works fully offline.
* Bad, because two copies of a walk can disagree and need merging; the spec rules this out.
