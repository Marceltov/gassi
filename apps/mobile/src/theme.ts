// The app's colors, sizes and the hook that picks light or dark.
import { useColorScheme } from "react-native";

const kinds = {
  walk: "#2e7d4f",
  food: "#b8571a", // a clear orange, dark enough for white text (4.8:1); Poopoo stays brown
  training: "#3b5ba5",
  pee: "#b08a16",
  poop: "#6b4a2b",
};

// The icon squares of Mehr's lists and the other lists' rows (like the iPhone's settings): the weight's rose, the
// household's violet, the devices' slate, the watch's grey. Vorrat uses food, Hunde walk, Übungen training.
const listTones = {
  weight: "#d4567a",
  household: "#8a5ad6",
  device: "#5f6b7a",
  garmin: "#3a4048",
};

// Start's big tiles and every colored button: each kind's color as a diagonal from lighter (top left) to darker
// (bottom right), with white on it.
const gradients = {
  walk: ["#3fb26b", "#1f7a45"],
  food: ["#ee8a32", "#b8571a"],
  training: ["#5a7fe0", "#2f4ea8"],
  pee: ["#d4a92a", "#8f6d0c"],
  poop: ["#8c6440", "#533720"],
} as const;
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
export type ButtonKind = keyof typeof kinds | "neutral";
export type ListTone = keyof typeof kinds | keyof typeof listTones;

/** `#rrggbb` as `rgba(...)`. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
export type TileKind = keyof typeof gradients;

export const radius = { button: 20, tile: 12, sheet: 24, bigTile: 22 };
export const space = { gutter: 14, gap: 8 };

/** Follows the system; dark when the system says nothing. */
export function useTheme(): Palette {
  return useColorScheme() === "light" ? palettes.light : palettes.dark;
}
