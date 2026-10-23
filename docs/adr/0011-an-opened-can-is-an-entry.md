---
status: accepted
date: 2026-10-23
decision-makers: Marcel Bruckner
---

# An opened can is an entry; Vorrat counts closed cans

## Context and Problem Statement

What matters is how much each dog ate. Vorrat counted wet food down by the grams fed, out of the can size a feeding
named (#73), with ½ cans and quarters. Real feedings don't fit that: the open can runs out in the middle of a feeding
"all the time", a second one is opened, and several cans can be open at once. Working out what is left in each open
can from grams drifts (spills, rounding, a bit for the other dog), and the Futter sheet had to ask for a can size.

## Considered Options

* Keep counting grams per can size, with the feeding naming its can (or several, with grams per can)
* Track the open cans (what is left in each), split each feeding over them
* A feeding names no can; opening a can is its own entry, and Vorrat counts closed cans

## Decision Outcome

Chosen option: "a feeding names no can; opening a can is its own entry". A new entry type `opened` (wet, `unitG`,
`amountG` = one can, no dogs) comes from the command `can.open`, sent next to the feeding by "+ Dose aufgemacht" in the
Futter sheet. Wet stock per size is the last count + bought − opened, in whole cans; feedings only count for "reicht
etwa". A Zählung takes whole closed cans. Open cans are not tracked.

As its own entry rather than a field on the feeding: a mistaken one is deleted in Verlauf like any entry, a can can be
opened in any feeding, and there is no partial-can state to keep right. A can whose tap was forgotten is set right by
a Zählung.

### Consequences

* Good: the grams per dog stay exact and the Futter sheet asks nothing about cans; the closed-can count can be checked
  against the cupboard and doesn't drift.
* Bad: older feedings stop counting against Vorrat, so it is right again only after one Zählung after the change; the
  app can't say what is left in an open can.
