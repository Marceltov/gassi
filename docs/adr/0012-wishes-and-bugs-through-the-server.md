---
status: accepted
date: 2026-10-23
decision-makers: Marcel Bruckner
---

# Wünsche und Fehler go through the server to GitHub

## Context and Problem Statement

Herzii should see in the app what is already planned or reported (#45) and report a wish or a bug from the phone
(#39), so it lands as a GitHub issue Marcel works on. GitHub needs a token for writing, and for reading while the repo
is private. Where does that token live, and how much of GitHub does the app rebuild?

## Considered Options

* The app talks to GitHub itself, with a token on each phone
* The server talks to GitHub with one token; the app only knows our API
* No integration: a link to GitHub's own new-issue page

## Decision Outcome

Chosen option: "the server talks to GitHub with one token". `FEEDBACK_GITHUB_REPO` and `FEEDBACK_GITHUB_TOKEN`
(both or none) switch it on; without them `me` says `issues: false`, Mehr has no row, and `/api/issues` is a 404, so a
self-hoster sees nothing of it. The token is fine-grained: issues read and write on that one repo. The server keeps
the list for five minutes (and shows it stale when GitHub doesn't answer), files a report with its kind's label
(`enhancement`, `bug`) and `from-app`, adds who sent it from which device and app version, and limits reports per
device with the sign-in throttle's buckets (ADR 0009). The app shows a list and links to GitHub for the rest (Marcel
on #45: don't rebuild GitHub's UI).

### Consequences

* Good, because no phone holds a GitHub token, and a self-hoster without GitHub is not affected.
* Good, because Herzii needs no GitHub account to report something.
* Bad, because the list lags GitHub by up to five minutes, and while the repo is private a tapped issue opens only for
  people with access to it.
