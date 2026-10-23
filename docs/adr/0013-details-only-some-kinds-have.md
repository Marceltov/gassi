---
status: accepted
date: 2026-10-23
decision-makers: Marcel Bruckner
---

# What only some kinds of entries have goes into one `details` column

## Context and Problem Statement

A poop gets a consistency (#86); dog encounters (#37) and encounters with people (#90) bring several fields each
(a reaction level, how we handled it, distance, who, where, mood, …). The entry table has a column per field all kinds
share (`amount_g`, `food_kind`, `unit_g`, `note`). Where do fields go that only one or two kinds have?

## Considered Options

* A column per field on `entry`
* A child table per kind (like walkers, pauses, exercises)
* One `details` column holding JSON, its shape checked by the domain

## Decision Outcome

Chosen option: "one `details` column holding JSON". `packages/domain` defines `entryDetails` (a zod object of optional
fields, strict) and which kinds may have each field (`checkDetails`); the contract, the server and the apps use that
one schema. Reading a row parses it with the same schema, so what reaches the code is typed. Taps keep their own
commands: a consistency is set by `log.consistency`, which names its poop by dog and time (the walk screen matches its
taps the same way), so it works offline like every other tap (ADR 0001).

Markings (#38) are no detail but their own entry type `mark`, for one dog, like pee: they are counted, not described.

### Consequences

* Good, because a new kind's fields need no migration, and each stays checked in one place.
* Good, because the first schema change on real data (`0.4_details_marks`) only adds empty columns.
* Bad, because SQL can't filter on a detail cheaply; statistics (#33) read entries and look at their details in code,
  as they already do for walks.
