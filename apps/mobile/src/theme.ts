// The app's colors, sizes and the hook that picks light or dark.
import { useColorScheme } from "react-native";
import { danger, gradients, kinds } from "./colors";

// The icon squares of Mehr's lists and the other lists' rows (like the iPhone's settings): the weight's rose, the
// household's violet, the devices' slate, the watch's grey, the treats' teal. Vorrat uses food, Hunde walk, Übungen
// training.
const listTones = {
  weight: "#d4567a",
  treat: "#17797a",
  household: "#8a5ad6",
  device: "#5f6b7a",
  garmin: "#3a4048",
};


// a soft shadow under a tile or colored button and a light top edge on it; lighter on a light background. A neutral
// button is calmer: a faint shadow and edge only.
const edge = "inset 0 1px 0 rgba(255,255,255,0.25)";

// Start's four top tiles are tinted: the kind's gradient at this opacity (light end, dark end) over the surface.
const tints: Record<"dark" | "light", [number, number]> = { dark: [0.32, 0.12], light: [0.26, 0.1] };

export const palettes = {
  dark: {
    ...kinds,
    ...listTones,
    tint: tints.dark,
    danger: danger.dark,
    neutral: "#2a2f37",
    background: "#111418",
    surface: "#1c2026",
    ink: "#e8eaed",
    muted: "#9aa0a6",
    line: "#2a2d33",
    gradients,
    raised: `0 6px 16px rgba(0,0,0,0.35), ${edge}`,
    pressable: `0 4px 12px rgba(0,0,0,0.3), ${edge}`,
    calm: "0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.07)",
  },
  light: {
    ...kinds,
    ...listTones,
    tint: tints.light,
    danger: danger.light,
    neutral: "#dfe3e8",
    background: "#f3f4f6",
    surface: "#ffffff",
    ink: "#1b1f24",
    muted: "#5f6670",
    line: "#d5d9de",
    gradients,
    raised: `0 6px 14px rgba(27,31,36,0.18), ${edge}`,
    pressable: `0 4px 10px rgba(27,31,36,0.16), ${edge}`,
    calm: "0 1px 3px rgba(27,31,36,0.12), inset 0 1px 0 rgba(255,255,255,0.7)",
  },
};

export type Palette = typeof palettes.dark;
/** A kind's color (the thing it is about), "neutral" (a calm grey, on the go), "side" (outlined: a side action off
 * the go), "ink" (dark: the main action of a page without a color, #80), "danger" (red: confirming a delete) and
 * "dangerSide" (outlined in red: the trash button). */
export type ButtonKind = keyof typeof kinds | "neutral" | "side" | "ink" | "danger" | "dangerSide";
export type ListTone = keyof typeof kinds | keyof typeof listTones;

/** `#rrggbb` as `rgba(...)`. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
export type TileKind = keyof typeof gradients;

export const radius = { button: 20, tile: 12, sheet: 24, bigTile: 22 };
export const space = { gutter: 14, gap: 8 };
/** The height of a text field, and of the small button that sits beside one. */
export const FIELD_HEIGHT = 44;

/** Follows the system; dark when the system says nothing. */
export function useTheme(): Palette {
  return useColorScheme() === "light" ? palettes.light : palettes.dark;
}
