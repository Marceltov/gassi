---
status: accepted
date: 2026-10-20
decision-makers: Marcel Bruckner
---

# "During a walk" is decided by time, not by links

## Context and Problem Statement

A walk's summary counts the pee and poop during it and lists its trainings; a training started from the walk screen
returns to that walk. v1's principle is that everything is an entry and pee/poop during a walk are separate entries,
not nested. How does Gassi know that a pee or a training belongs to a walk?

## Considered Options

* By time: an entry belongs to the walk whose interval (start to end, or now while it runs) holds its `at`
* By a link: a `walk_id` column on the entries logged during a walk

## Decision Outcome

Chosen option: "By time", because it keeps pee, poop and trainings plain entries (v1's model stays one list), works
for taps that arrive after the walk was stopped on the other phone, and makes editing a walk's start or end move
what belongs to it without rewriting links.

### Consequences

* Good, because an offline pee whose time lies after the walk's end is simply a normal entry outside the walk, the
  rule the spec asks for, with no special case.
* Good, because pee/poop logged from the Heute tiles during a walk count for it too.
* Bad, because a training at home while the other person is out on a walk counts in that walk's summary; for one
  household this is rare and harmless.

### Confirmation

`backend/sessions.test.ts` "summary counts pee/poop inside the walk's time only" and "late pipi after stop is a plain
entry"; `Sessions.summary` and the training view use the interval only.
