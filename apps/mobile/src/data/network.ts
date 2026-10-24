// Being back online, from Android's network state (expo-network), so queued taps go out at once. The web hears it from
// the browser (network.web.ts).
import { addNetworkStateListener } from "expo-network";

export function onReconnect(fn: () => void): () => void {
  let offline = false;
  const subscription = addNetworkStateListener(({ isConnected, isInternetReachable }) => {
    const nowOffline = isConnected === false || isInternetReachable === false;
    if (offline && !nowOffline) fn();
    offline = nowOffline;
  });
  return () => subscription.remove();
}
