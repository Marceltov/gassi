// Pull to refresh (#122): a pull on a page's scrolling part (PullScroll) refreshes the store and what the screen in
// front read from the server itself (useServer adds its read here while its screen is in front). The spinner stays
// until all of it has answered.
import { useState } from "react";
import { useGassi } from "../data/GassiProvider";

const reads = new Set<() => Promise<void>>();

/** Adds what a screen in front reads; the returned function takes it out again. */
export function onPull(read: () => Promise<void>): () => void {
  reads.add(read);
  return () => void reads.delete(read);
}

export type Pull = { refreshing: boolean; onRefresh: () => void };

/** The pull for a page; null while signed out, when there is nothing to refresh. */
export function usePull(): Pull | null {
  const { signedIn, refresh } = useGassi();
  const [refreshing, setRefreshing] = useState(false);
  if (!signedIn) return null;
  const onRefresh = () => {
    setRefreshing(true);
    void Promise.allSettled([refresh(), ...[...reads].map((read) => read())]).then(() => setRefreshing(false));
  };
  return { refreshing, onRefresh };
}
