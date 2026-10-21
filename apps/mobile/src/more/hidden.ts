// The can sizes hidden from Vorrat's purchase rows on this phone (Ruling Z), per person, kept with the rest
// (data/kept.ts) and so forgotten at sign-out. When a hidden size comes back is the domain's (stillHidden).
import type { HiddenSize } from "@gassi/domain";
import { loadKept, saveKept } from "../data/kept";

const key = (personId: string) => `stock-hidden.${personId}`;

export function loadHidden(personId: string): HiddenSize[] {
  const kept = loadKept(key(personId));
  return Array.isArray(kept) ? kept.filter((h): h is HiddenSize => typeof h?.unitG === "number" && typeof h?.at === "string") : [];
}

export const saveHidden = (personId: string, hidden: readonly HiddenSize[]): void => saveKept(key(personId), hidden);
