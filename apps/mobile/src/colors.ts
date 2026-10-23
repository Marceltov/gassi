// The kind colors and the contrast rules for what sits on a color. Pure, so tests can import it without React Native.

export const kinds = {
  walk: "#2e7d4f",
  food: "#b8571a", // a clear orange; Poopoo stays a duller brown
  training: "#3b5ba5",
  pee: "#8e6a00", // a dark gold: the lighter yellows fail with white text
  poop: "#6b4a2b",
  encounter: "#7a3e8e", // dog and person encounters (#37, #90)
};

// Start's big tiles and every colored button: each kind's color as a diagonal from lighter (top left) to darker
// (bottom right), with white on it. Even the light end keeps 4.5:1 for white (colors.test.ts).
export const gradients = {
  walk: ["#2a8250", "#14562f"],
  food: ["#b8571a", "#8a3a0c"],
  training: ["#4566bf", "#263f8a"],
  pee: ["#8e6a00", "#5f4600"],
  poop: ["#7a5535", "#45301a"],
  encounter: ["#86469b", "#552463"],
} as const;

// Something that needs fixing before it can be saved (a can size without grams): red as text and as an outline, on the
// page and on a card, in each theme (colors.test.ts).
export const danger = { dark: "#ff7b72", light: "#b42318" };

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, (n >> 0) & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two `#rrggbb` colors (1 to 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const WHITE = "#ffffff";
const DARK_INK = "#1b1f24";

/** The text or icon color for something sitting on `hex`: white, or a dark ink when that reads better. */
export function onColor(hex: string): string {
  return contrast(hex, WHITE) >= contrast(hex, DARK_INK) ? WHITE : DARK_INK;
}
