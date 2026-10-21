// The app's colors, sizes and the hook that picks light or dark.
import { useColorScheme } from "react-native";

const kinds = {
  walk: "#2e7d4f",
  food: "#8a5a1f",
  training: "#3b5ba5",
  pee: "#b08a16",
  poop: "#6b4a2b",
};

// Start's big tiles: each kind's color as a diagonal from lighter (top left) to darker (bottom right), with white on it.
const gradients = {
  walk: ["#3fb26b", "#1f7a45"],
  food: ["#d08a2c", "#8f5a16"],
  training: ["#5a7fe0", "#2f4ea8"],
} as const;
// a soft shadow under a tile and a light top edge on it; lighter on a light background
const edge = "inset 0 1px 0 rgba(255,255,255,0.25)";

export const palettes = {
  dark: { ...kinds, neutral: "#2a2f37", background: "#111418", surface: "#1c2026", ink: "#e8eaed", muted: "#9aa0a6", line: "#2a2d33", gradients, raised: `0 6px 16px rgba(0,0,0,0.35), ${edge}` },
  light: { ...kinds, neutral: "#dfe3e8", background: "#f3f4f6", surface: "#ffffff", ink: "#1b1f24", muted: "#5f6670", line: "#d5d9de", gradients, raised: `0 6px 14px rgba(27,31,36,0.18), ${edge}` },
};

export type Palette = typeof palettes.dark;
export type ButtonKind = keyof typeof kinds | "neutral";
export type TileKind = keyof typeof gradients;

export const radius = { button: 20, tile: 12, sheet: 24, bigTile: 22 };
export const space = { gutter: 14, gap: 8 };

/** Follows the system; dark when the system says nothing. */
export function useTheme(): Palette {
  return useColorScheme() === "light" ? palettes.light : palettes.dark;
}
