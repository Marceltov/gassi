// The Start tiles with the taps that have not reached the server yet laid over: a feeding or a pee/poop tapped
// without reception shows at once, as the person who tapped (the server's answer replaces it); a feeding with its grams
// and kind, for Start's "zuletzt 80 g nass".
import type { Command } from "./commands";
import type { FoodKind } from "./entryTypes";
import type { Person } from "./sessionProjection";

/** What a tile shows of an entry. */
export type TileEntry = { at: string; endedAt: string | null; byName: string; amountG?: number | null; foodKind?: FoodKind | null };
export type Tiles<E extends TileEntry = TileEntry> = { walk: E | null; food: E | null; pee: E | null; poop: E | null };

/** `today` with the pending feedings and pee/poop laid over it; the newest of a kind wins (the server's on a tie). */
export function layerToday<E extends TileEntry>(today: Tiles<E> | null, pending: readonly Command[], me: Person | null): Tiles<E | TileEntry> {
  const tiles: Tiles<E | TileEntry> = today ?? { walk: null, food: null, pee: null, poop: null };
  if (!me) return tiles;
  const out = { ...tiles };
  for (const c of pending) {
    // a marking is no pee: it has no tile
    const tile = c.kind === "food" ? "food" : c.kind === "log" && c.type !== "mark" ? c.type : null;
    if (!tile) continue;
    const shown = out[tile];
    if (shown && c.at <= (shown.endedAt ?? shown.at)) continue;
    const tapped = { at: c.at, endedAt: null, byName: me.name };
    out[tile] = c.kind === "food" ? { ...tapped, amountG: c.amountG, foodKind: c.foodKind } : tapped;
  }
  return out;
}
