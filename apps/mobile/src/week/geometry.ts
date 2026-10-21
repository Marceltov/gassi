// Where a bar or tick sits on a day's strip, in minutes since midnight. Short ones are widened to stay visible and
// kept inside the day, so a bar or tick at 23:59 is not cut off.
export const DAY = 24 * 60;
const MIN_WIDTH = 6;

export function barSpan(startMin: number, endMin: number): { left: number; width: number } {
  const left = Math.min(Math.max(startMin, 0), DAY - MIN_WIDTH);
  return { left, width: Math.min(Math.max(endMin - startMin, MIN_WIDTH), DAY - left) };
}

export const tickSpan = (min: number) => barSpan(min, min);
