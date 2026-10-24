// What Hermes lacks and the shared code needs, set before anything else loads (app/_layout.tsx imports this first):
// crypto.getRandomValues for newId (@gassi/domain's commands.ts), from expo-crypto.
import { getRandomValues } from "expo-crypto";

const g = globalThis as { crypto?: Partial<Crypto> };
if (typeof g.crypto?.getRandomValues !== "function") {
  g.crypto = { ...g.crypto, getRandomValues: getRandomValues as Crypto["getRandomValues"] };
}
