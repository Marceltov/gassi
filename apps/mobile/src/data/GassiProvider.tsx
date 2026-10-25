// The app's data for every screen: useGassi() gives the household, the running walk and training (with this phone's
// unsent taps laid over), `send` for taps and `refresh`. Without a device (never signed in, or a 401 signed it out)
// `signedIn` is false and the root layout shows the sign-in. Refreshes when the app comes to the front and every 30 s
// while a walk or training runs or taps wait to go out.
import type { Client } from "@gassi/api-client";
import type { Command } from "@gassi/domain";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { APP_VERSION } from "../version";
import { onCrash } from "./crashes";
import { events } from "./events";
import { loadDevice, subscribeDevice } from "./device";
import { createGassiStore, type GassiState, type GassiStore } from "./store";

export type Gassi = GassiState & { signedIn: boolean; api: Client | null; writeApi: Client | null; send(cmd: Command): void; refresh(): Promise<void> };

const REFRESH_MS = 30_000;
const signedOut: GassiState = { me: null, device: null, household: null, people: [], dogs: [], exercises: [], treatKinds: [], view: { walk: null, training: null }, pending: [], unsent: 0, online: true, syncError: null };
const noStore = { subscribe: () => () => {}, get: () => signedOut };

const GassiContext = createContext<Gassi | null>(null);

export function GassiProvider({ children }: { children: ReactNode }) {
  const device = useSyncExternalStore(subscribeDevice, loadDevice, loadDevice);
  const store: GassiStore | null = useMemo(() => (device ? createGassiStore(device, { version: APP_VERSION }) : null), [device]);
  const source = store ?? noStore;
  const state = useSyncExternalStore(source.subscribe, source.get, source.get);

  useEffect(() => {
    if (!store) return;
    const stop = store.start();
    void store.refresh();
    const onFront = AppState.addEventListener("change", (s) => s === "active" && void store.refresh());
    const stopCrashes = onCrash((error) => events.error("Absturz", error));
    return () => {
      stop();
      stopCrashes();
      onFront.remove();
    };
  }, [store]);

  const busy = !!(state.view.walk || state.view.training) || state.unsent > 0;
  useEffect(() => {
    if (!store || !busy) return;
    const timer = setInterval(() => void store.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [store, busy]);

  const value = useMemo<Gassi>(
    () => ({ ...state, signedIn: !!store, api: store?.api ?? null, writeApi: store?.writeApi ?? null, send: (cmd) => store?.send(cmd), refresh: () => store?.refresh() ?? Promise.resolve() }),
    [state, store],
  );
  return <GassiContext.Provider value={value}>{children}</GassiContext.Provider>;
}

export function useGassi(): Gassi {
  const gassi = useContext(GassiContext);
  if (!gassi) throw new Error("useGassi needs the GassiProvider (app/_layout.tsx)");
  return gassi;
}
