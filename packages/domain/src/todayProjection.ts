// The Start tiles with the taps that have not reached the server yet laid over: a feeding or a pee/poop tapped
// without reception shows at once, as the person who tapped (the server's answer replaces it).
import type { Command } from "./commands";
import type { Person } from "./sessionProjection";

/** What a tile shows of an entry. */
export type TileEntry = { at: string; endedAt: string | null; byName: string };
export type Tiles<E extends TileEntry = TileEntry> = { walk: E | null; food: E | null; pee: E | null; poop: E | null };

/** `today` with the pending feedings and pee/poop laid over it; the newest of a kind wins (the server's on a tie). */
export function layerToday<E extends TileEntry>(today: Tiles<E> | null, pending: readonly Command[], me: Person | null): Tiles<E | TileEntry> {
  const tiles: Tiles<E | TileEntry> = today ?? { walk: null, food: null, pee: null, poop: null };
  if (!me) return tiles;
  const out = { ...tiles };
  for (const c of pending) {
    const tile = c.kind === "food" ? "food" : c.kind === "log" ? c.type : null;
    if (!tile) continue;
    const shown = out[tile];
    if (!shown || c.at > (shown.endedAt ?? shown.at)) out[tile] = { at: c.at, endedAt: null, byName: me.name };
  }
  return out;
}
