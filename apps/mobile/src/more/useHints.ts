// The state of the two settings recording in the pocket needs (hints.ts), read again whenever the app comes back to
// the foreground (the person was in Android's settings). Null until known. `leave` goes back to the Runde while this
// phone records (the first recording brought the person here), else to Mehr.
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useRecording } from "../track/Recording";
import { backgroundAllowed, batteryUnrestricted } from "../track/hints";

export function useHints() {
  const router = useRouter();
  const { mine } = useRecording();
  const [always, setAlways] = useState<boolean | null>(null);
  const [battery, setBattery] = useState<boolean | null>(null);
  const check = useCallback(() => {
    void backgroundAllowed().then(setAlways, () => setAlways(false));
    void batteryUnrestricted().then(setBattery, () => setBattery(null));
  }, []);
  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (s) => (s === "active" ? check() : undefined));
    return () => sub.remove();
  }, [check]);
  const leave = useCallback(() => (mine ? router.navigate("/runde") : router.navigate("/mehr")), [mine, router]);
  return { always, battery, check, leave };
}
