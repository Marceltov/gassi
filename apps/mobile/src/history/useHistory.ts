// Verlauf's entries for a filter, from the server, a page at a time. Whenever the screen comes to the front (so an
// edit or delete shows) the pages it had are read again, as many entries as were shown; a new filter starts at its
// first page. `loadMore` adds the next page. A refresh outranks a page being added: that page's answer is dropped,
// and no page is added while a refresh runs. An answer that came too late for the filter shown is dropped too.
import type { Client } from "@gassi/api-client";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { errorMessage } from "../data/api";
import { useGassi } from "../data/GassiProvider";
import { type Entry, type Filter, historyQuery } from "./form";

export type HistoryState = { entries: Entry[] | null; more: boolean; loadingMore: boolean; error: string | null; loadMore(): void };
type List = { key: string; entries: Entry[]; more: boolean };

/** Pages from `offset` on until `wanted` entries are there or there are no more; each entry once. */
async function readPages(api: Client, filter: Filter, offset: number, wanted: number, have: Entry[] = []): Promise<{ entries: Entry[]; more: boolean }> {
  let entries = have;
  let more = true;
  let at = offset;
  do {
    const page = await api.entries(historyQuery(filter, at));
    // an entry that moved onto the next page since (one was added) is shown once
    entries = [...entries, ...page.entries.filter((e) => !entries.some((s) => s.id === e.id))];
    more = page.more;
    at += page.entries.length;
  } while (more && entries.length < wanted);
  return { entries, more };
}

export function useHistory(filter: Filter): HistoryState {
  const { api } = useGassi();
  const key = JSON.stringify(filter);
  const [list, setList] = useState<List | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const kept = useRef<List | null>(null); // the list as last set, for how many entries a refresh reads again
  const keep = (l: List) => {
    kept.current = l;
    setList(l);
  };
  const refreshes = useRef(0); // each refresh, so an older one's answer is dropped
  const refreshing = useRef(false);
  const adding = useRef(0); // each added page, dropped when a refresh came after it

  useFocusEffect(
    useCallback(() => {
      if (!api) return;
      const n = ++refreshes.current;
      const f = JSON.parse(key) as Filter;
      refreshing.current = true;
      setLoadingMore(false);
      readPages(api, f, 0, kept.current?.key === key ? kept.current.entries.length : 1).then(
        (page) => {
          if (n !== refreshes.current) return;
          refreshing.current = false;
          keep({ key, ...page });
          setError(null);
        },
        (e) => {
          if (n !== refreshes.current) return;
          refreshing.current = false;
          setError(errorMessage(e));
        },
      );
    }, [api, key]),
  );

  const shown = list?.key === key ? list : null;
  const loadMore = () => {
    if (!api || !shown || !shown.more || loadingMore || refreshing.current) return;
    const since = refreshes.current;
    const n = ++adding.current;
    setLoadingMore(true);
    readPages(api, filter, shown.entries.length, 1, shown.entries).then(
      (page) => {
        if (n !== adding.current || since !== refreshes.current) return;
        keep({ key, ...page });
        setError(null);
        setLoadingMore(false);
      },
      (e) => {
        if (n !== adding.current || since !== refreshes.current) return;
        setError(errorMessage(e));
        setLoadingMore(false);
      },
    );
  };

  return { entries: shown?.entries ?? null, more: shown?.more ?? false, loadingMore, error, loadMore };
}
