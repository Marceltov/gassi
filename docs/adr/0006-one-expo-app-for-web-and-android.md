---
status: accepted
date: 2026-10-21
decision-makers: Marcel Bruckner
---

# One Expo app for the web and Android

## Context and Problem Statement

ADR 0005 chose an Android app with Expo and a web app for everyone else, and accepted that the screens would be
written twice (web and Android), sharing only the rules (`packages/domain`) and the API (`packages/api-client`). Before
step 2 (the web app) was built, Marcel asked whether the two could be one app: the same screens, navigation, state and
offline queue, with only the controls native per platform.

## Decision Drivers

* No redundancy (CLAUDE.md): a screen, its copy and its behaviour should exist once.
* The Android app must look and feel native (ADR 0005); the web app must be an installable, phone-first PWA.
* One container per household: the server serves the API and the web app from one origin.
* The code stays portable, so the community can bring it to iOS.

## Considered Options

* Two apps: a Next.js web app in `apps/server` and an Expo app for Android (ADR 0005)
* One Expo app (Expo Router, React Native Web), exported for the web and built for Android
* One web app, wrapped for Android (Capacitor), already turned down in ADR 0005

## Decision Outcome

Chosen option: "One Expo app", in `apps/mobile`.

- **Screens, navigation and data once.** Expo Router screens, the device token, the command queue and the household
  snapshot (`src/data`) are shared. What a platform stores or shows differently sits behind a small module with a
  platform file: `.web.ts`/`.web.tsx` now (localStorage, Leaflet maps, the browser's date picker, the Clipboard API, an
  SVG curve), the Android files in step 3, so screens don't change.
- **Controls per platform.** The web uses React Native Web with `.web.tsx` controls where the browser has a better one;
  Android gets Jetpack Compose controls through `@expo/ui` in step 3; SwiftUI controls (`@expo/ui` too) are possible
  later for an iOS app by the community.
- **The web app from the server.** `expo export --platform web` (one bundle, so screens open offline) is copied into
  `apps/server/public` at build time (`scripts/web.mjs`, which never overwrites the server's own files); Next.js answers
  every path it doesn't know with the app's `index.html`. The image stays one container; a manifest, Apple tags and a
  small service worker (the app shell, never `/api/*`) make it installable and let it open without reception.
- This reverses ADR 0005's "screens are written twice"; the rest of ADR 0005 (Android native with background GPS, no
  iOS app from us, EAS during development, the order of steps) stands.

### Consequences

* Good, because every screen exists once; a fix on the web is a fix on Android.
* Good, because the e2e tests (Playwright against the server's build, `apps/server/e2e`) cover the screens Android uses.
* Bad, because the web app is a React Native Web app rather than plain HTML: larger first load, and browser behaviour
  (inputs, pickers, scrolling) needs `.web.tsx` files where React Native Web falls short.
* Bad, because each platform module needs both files kept to one interface; the web file checks itself against the
  native one's types (`sameAsNative`).
