// Verlauf's entries for a filter, from the server, a page at a time: the first page again whenever the screen comes
// to the front (so an edit or delete shows) and when the filter changes; `more` adds the next page. An answer that
// came too late for the filter shown is dropped.
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { errorMessage } from "../data/api";
import { useGassi } from "../data/GassiProvider";
import { type Entry, type Filter, historyQuery } from "./form";

export type HistoryState = { entries: Entry[] | null; more: boolean; loadingMore: boolean; error: string | null; loadMore(): void };

export function useHistory(filter: Filter): HistoryState {
  const { api } = useGassi();
  const key = JSON.stringify(filter);
  const [list, setList] = useState<{ key: string; entries: Entry[]; more: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const asked = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (!api) return;
      const n = ++asked.current;
      setLoadingMore(false);
      api.entries(historyQuery(JSON.parse(key) as Filter, 0)).then(
        (page) => {
          if (n !== asked.current) return;
          setList({ key, entries: page.entries, more: page.more });
          setError(null);
        },
        (e) => n === asked.current && setError(errorMessage(e)),
      );
    }, [api, key]),
  );

  const shown = list?.key === key ? list : null;
  const loadMore = () => {
    if (!api || !shown || !shown.more || loadingMore) return;
    const n = ++asked.current;
    setLoadingMore(true);
    api.entries(historyQuery(filter, shown.entries.length)).then(
      (page) => {
        if (n !== asked.current) return;
        // an entry that moved onto this page since (one was added) is shown once
        setList({ key, entries: [...shown.entries, ...page.entries.filter((e) => !shown.entries.some((s) => s.id === e.id))], more: page.more });
        setError(null);
        setLoadingMore(false);
      },
      (e) => {
        if (n !== asked.current) return;
        setError(errorMessage(e));
        setLoadingMore(false);
      },
    );
  };

  return { entries: shown?.entries ?? null, more: shown?.more ?? false, loadingMore, error, loadMore };
}
