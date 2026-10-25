// What the app's usage events say (#115, events.ts), shaped here so that nothing personal goes along: a command names
// its kind and only what kind of tap it was (pee or poop, worked or not), never a note, an encounter's details, a name
// or a position.
import type { Command } from "@gassi/domain";
import type { EventData } from "./events";

type Usage = { name: string; data: EventData };

export function commandEvent(c: Command): Usage {
  const data: EventData = {};
  if ("type" in c) data.type = c.type;
  if ("ok" in c) data.ok = c.ok;
  return { name: c.kind, data };
}

/** A tap's name: the button's own event name when its label or accessibility name holds data (a typed amount, the
 * household's exercise names), else its accessibility name or label. */
export const tapName = ({ event, a11y, label }: { event?: string; a11y?: string; label: string }): string => event ?? a11y ?? label;

/** A call to the server for the household, the queue's taps or the running walk: how long, whether it worked, and
 * how many taps wait. */
export const syncEvent = (part: "household" | "commands" | "sessions", ms: number, ok: boolean, queued: number): Usage => ({ name: part, data: { ms: Math.round(ms), ok, queued } });

/** A batch of the route sent: how many positions, and the server's answer (null: it didn't arrive). */
export const batchEvent = (points: number, answer: { stored: boolean; recording: boolean } | null): Usage => ({
  name: "batch",
  data: answer ? { points, ok: true, stored: answer.stored, recording: answer.recording } : { points, ok: false },
});
