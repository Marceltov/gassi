// What the food sheet last learned from the server (the recent portions, each kind's last grams, the stock), so it
// opens with them without reception. The web keeps them in localStorage; elsewhere only while the app runs.
import type { Output } from "@gassi/api-client";
import type { Portion } from "@gassi/domain";

export type FoodFacts = { recent: Portion[]; last: Output<"lastFood"> | null; stock: Output<"stock"> | null };

const KEY = "gassi.food";
let current: { personId: string; facts: FoodFacts } | null = null;

export function loadFacts(personId: string): FoodFacts {
  if (current?.personId === personId) return current.facts;
  try {
    const s = JSON.parse(localStorage.getItem(`${KEY}.${personId}`) ?? "null") as FoodFacts | null;
    if (s && Array.isArray(s.recent)) return s;
  } catch {
    // no storage here, or something else in it: start from nothing
  }
  return { recent: [], last: null, stock: null };
}

export function saveFacts(personId: string, facts: FoodFacts): void {
  current = { personId, facts };
  try {
    localStorage.setItem(`${KEY}.${personId}`, JSON.stringify(facts));
  } catch {
    // storage full, blocked or not there: the next opening waits for the server
  }
}
