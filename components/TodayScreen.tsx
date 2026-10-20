"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { logEntry } from "@/app/actions";
import type { TodayView, User } from "@/backend";
import type { EntryType } from "@/shared/entryTypes";
import { dayHeading } from "@/shared/time";
import { EntryList } from "./EntryList";
import { FoodSheet } from "./FoodSheet";
import { TodayTiles } from "./TodayTiles";
import { useEntrySheet } from "./useEntrySheet";
import { useLiveRefresh } from "./useLiveRefresh";
import { useNow } from "./useNow";
import { newId, useSessions } from "./useSessions";

// Heute: the Gassi card, Futter and Training, Pipi and Poopoo in between, then today's entries; who is out with the
// dog right now shows in the leash bar above the bottom nav. The Gassi tile starts
// a walk (or opens the running one), Futter opens the food sheet; Pipi and Poopoo log "now, by me". The page reloads its data after every change,
// when the app comes back to the foreground and every 30 s, so the other phone's walk shows up.
export function TodayScreen({ view, user }: { view: TodayView; user: User }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const now = useNow(view.now);
  const sheet = useEntrySheet(view.timeZone);
  const sessions = useSessions(view.sessions, user, refresh);
  const [busy, startTransition] = useTransition();
  const [foodOpen, setFoodOpen] = useState(false);
  const closeFood = useCallback(() => setFoodOpen(false), []);
  useLiveRefresh();
  const { walk, training } = sessions.view;

  const quickLog = (type: EntryType) => {
    if (type === "walk") {
      if (!walk) return void sessions.push({ kind: "walk.start", walkKey: newId() }).then(() => router.push("/runde"));
      return router.push("/runde");
    }
    if (type === "food") return setFoodOpen(true);
    startTransition(async () => {
      const r = await logEntry({ type, at: new Date().toISOString() });
      if (r.ok) sheet.logged(r.value);
      else sheet.show(r.error);
    });
  };

  const startTraining = () => {
    if (training) return router.push("/training");
    void sessions.push({ kind: "training.start", trainingKey: newId(), ...(walk ? { walkKey: walk.key } : {}) }).then(() => router.push("/training"));
  };

  return (
    <>
      <header className="mb-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Heute</h1>
        <p className="text-muted">{dayHeading(now, view.timeZone)}</p>
      </header>
      <TodayTiles tiles={view.tiles} walk={walk} training={training} onWalk={!!walk?.walkers.some((w) => w.username === user.username)} now={now} busy={busy} onLog={quickLog} onDetails={sheet.openNew} onTraining={startTraining} />
      <section aria-labelledby="today-list" className="mt-8">
        <h2 id="today-list" className="mb-2 text-xl font-bold">
          Was heute mit {view.dogName} war
        </h2>
        {view.entries.length > 0 ? <EntryList entries={view.entries} timeZone={view.timeZone} onSelect={sheet.openEdit} /> : <p className="py-6 text-muted">Noch nichts eingetragen. Tipp oben auf eine Kachel, wenn etwas passiert.</p>}
      </section>
      {foodOpen && (
        <FoodSheet
          lastFood={view.lastFood}
          onClose={closeFood}
          onLogged={(e) => {
            setFoodOpen(false);
            sheet.logged(e);
          }}
        />
      )}
      {sheet.ui}
    </>
  );
}
