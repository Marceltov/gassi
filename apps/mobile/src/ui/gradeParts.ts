// A line split into its plain text and its grade counts ("✓3", "~", "✗0"), for Graded.tsx (its own file, so that tests need no React Native).
import { type Grade, GRADE_SIGN, GRADES } from "@gassi/domain";

export type Part = { text: string; grade?: Grade; zero?: boolean };

const BY_SIGN = new Map(GRADES.map((g) => [GRADE_SIGN[g], g]));
// a sign with its count, standing on its own: after the start or a space, before a space or the end
const TOKEN = /(?<=^|\s)([✓~✗])(\d*)(?=\s|$)/g;

export function gradedParts(text: string): Part[] {
  const parts: Part[] = [];
  let from = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > from) parts.push({ text: text.slice(from, m.index) });
    parts.push({ text: m[0], grade: BY_SIGN.get(m[1]), zero: m[2] === "0" });
    from = m.index + m[0].length;
  }
  if (from < text.length) parts.push({ text: text.slice(from) });
  return parts;
}
