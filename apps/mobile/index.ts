// The app's entry: the background recording's task is defined before anything else, as Android starts the bundle
// without a screen to deliver positions (src/track/background.ts, #108); then Expo Router.
import "./src/track/background";
import "expo-router/entry";
