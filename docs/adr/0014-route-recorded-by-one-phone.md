---
status: accepted
date: 2026-10-24
decision-makers: Marcel Bruckner
---

# A walk's route is recorded by one phone at a time, and filtered where it is shown

## Context and Problem Statement

The plan left the walk's GPS route to the Android app (step 3), which can record in the background. Marcel wants the
route now, from the web app (#104). A web page gets positions only while it is open and the screen is on, so the PWA
records while Gassi is open (with an option in Mehr to keep the screen on). When two people walk, both phones could
record. Phone GPS is noisy: a few metres of jitter, stray points near buildings, wobble while standing.

## Considered Options

* Every walker's phone records; the server shows the longest track (what step 1 built: `chooseTrack`)
* Every walker's phone records; the server merges or averages the paths
* One phone records at a time: the one that started the walk, and another can take over

## Decision Outcome

Chosen option: "one phone records at a time" (Marcel). The phone that starts a walk records its route; another
walker's phone takes over with the command `walk.record` ("this device records from now on"), queued and idempotent
like every tap (ADR 0001). The server keeps the recorders per walk with their times (`walk_recorder`) and shows each
recorder's points for its own time, joined (`joinTracks`), decided by time like everything during a walk (ADR 0002):
a phone that kept recording after a handover it hadn't heard of adds nothing past it. A watch track (step 4) is shown
instead of the phones' when there is one.

Phones upload raw points. One filter in `packages/domain` (`cleanTrack`: gates for bad accuracy and jumps, a Kalman
filter weighted by each point's accuracy and smoothed forward and back, nothing added while standing) runs wherever
distance and route are made; the recording phone runs it forward for the live distance (`createLiveFilter`).

### Consequences

* Good, because there is never more than one route to choose from, and no merging that could invent a path.
* Good, because raw points are kept: tuning the filter on real walks improves old walks too.
* Good, because the Android app reuses all of it and only adds recording with the screen off.
* Bad, because a recording phone in the pocket with the screen off leaves gaps (a straight line) until the Android
  app; "Bildschirm auf der Runde anlassen" trades battery for that.
* Bad, because the server filters on every read; a walk has a few thousand points at most, so this stays cheap.
