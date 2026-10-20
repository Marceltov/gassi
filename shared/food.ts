// Food amounts in words, for the stock screen and the food sheet.

/** "11½ Dosen", "1 Dose", "½ Dose". */
export function formatCans(cans: number): string {
  const whole = Math.floor(cans);
  const text = `${whole === 0 && cans % 1 ? "" : whole}${cans % 1 ? "½" : ""}`;
  return `${text} ${cans > 0 && cans <= 1 ? "Dose" : "Dosen"}`;
}

/** "4,4 kg" from 1 kg on, else "800 g". */
export const formatWeight = (grams: number): string =>
  grams >= 1000 ? `${(grams / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} kg` : `${Math.round(grams)} g`;

/** "0,5" or "0.5" → 0.5; empty or anything else → NaN. */
export const parseDecimal = (v: string): number => (v.trim() ? Number(v.trim().replace(",", ".")) : NaN);
