---
status: accepted
date: 2026-10-21
decision-makers: Marcel Bruckner
---

# Android native, a web app for everything else, iOS left to the community

Partly superseded by [ADR 0006](0006-one-expo-app-for-web-and-android.md): the web app and the Android app are one Expo
app, so screens are written once.

## Context and Problem Statement

The plan from 2026-10-20 was a native app for iOS and Android, a Garmin app and a web dashboard "for looking, not for
logging". Marcel questioned whether native apps are worth the hassle of emulators, devices and builds.

Gassi must record who walked when, who fed how much, who trained what, pee and poop, and the route of every walk. The
routes are "a large portion of what makes it interesting" (Marcel). The household:

- Marcel walks with an iPhone and a Garmin Forerunner. He never walks without the watch, which records his routes.
- Herzii walks with an Android phone and no watch. She doesn't like watches and wants exactly one app.

A web app cannot record GPS reliably with the screen locked (Chrome on Android pauses location in the background), so
Herzii's routes need a native app. Nothing else does.

## Considered Options

* Native apps for iOS and Android (the 2026-10-20 plan)
* An Android app with Expo, and a web app for everyone else
* The web app wrapped as an Android app with Capacitor and a background-location plugin
* Herzii records routes with an existing tracker (Komoot, Strava) that Gassi imports
* A Garmin watch for Herzii too, and no phone app

## Decision Outcome

Chosen option: "An Android app with Expo, and a web app for everyone else".

- **Android app** (React Native with Expo): walks with the GPS track recorded in the background, and everything else
  for daily use. Expo over Capacitor because background location is a maintained standard module, the app looks and
  feels native, and `packages/domain` is shared as is. Capacitor would be less code, but its free location plugin is
  basic and the reliable one is paid; Marcel: "I want it good and working".
- **Web app** instead of a dashboard: installable (PWA), phone-first, German, dark mode. It logs (walks without a
  track: start/stop, pauses, joining a walk, pee/poop during it; food, training, weight, stock, notes) and shows
  (today, history, week, statistics, maps), and serves as the dashboard on a big screen. Taps are queued on the
  device and sent when reception returns (ADR 0001).
- **No iOS app from us.** The code stays portable so the community can bring it to iOS.
- **Garmin app** as planned. It gets its access through the web app instead of an iOS app; how is designed in the
  Garmin step.
- **Expo's cloud service (EAS) during development:** EAS Build makes the Android builds, so no Android Studio or
  emulator is needed locally; EAS Update brings JavaScript fixes to the installed app without a new APK. This
  reverses the earlier "no EAS" for development only. For other households, updates through a third-party service
  still don't fit self-hosting; the release decides their update path (store updates, a self-hosted update server,
  or EAS).
- **Release:** open source, the APK on GitHub releases, a Play Store listing optional, no App Store from us.
- **Order:** 1 foundation (done), 2 the web app, 3 the Android app, 4 the Garmin app, 5 release. The web app comes
  first: it needs no device builds and lets both start logging; Herzii's walks get routes from step 3 on.

### Consequences

* Good, because there is no Mac, Xcode, Apple developer account or local emulator to maintain, and only one native
  app to test, on a real phone.
* Good, because Herzii has one app for everything, and Marcel's iPhone needs nothing but the web app.
* Bad, because screens are written twice (web and Android); only the rules and the API are shared.
* Bad, because iPhone users without a Garmin watch get no routes until someone builds the iOS app.
* Bad, because development depends on Expo's service and its free-plan limits; local builds remain the fallback.
