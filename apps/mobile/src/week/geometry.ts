// Where a bar or tick sits on a day's strip, in minutes since midnight. Short bars are widened to stay visible and
// kept inside the day, so a bar at 23:59 is not cut off; a tick is a few pixels wide whatever the strip's width.
export const DAY = 24 * 60;
const MIN_WIDTH = 6;

export function barSpan(startMin: number, endMin: number): { left: number; width: number } {
  const left = Math.min(Math.max(startMin, 0), DAY - MIN_WIDTH);
  return { left, width: Math.min(Math.max(endMin - startMin, MIN_WIDTH), DAY - left) };
}

/** How wide a tick is, in pixels. */
export const TICK_PX = 3;

/** A tick at `min`: its left edge there, `width` pixels wide and shifted left by `shift` pixels (its share of the day
 * of the tick's width), so one at 0:00 starts at the strip's left edge and one at 23:59 ends inside its right one. */
export function tickSpan(min: number): { left: number; width: number; shift: number } {
  const left = Math.min(Math.max(min, 0), DAY);
  return { left, width: TICK_PX, shift: 0 - (TICK_PX * left) / DAY };
}
