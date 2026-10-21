// The web's safe area: Expo Router's web provider reports zero insets, so the page asks CSS (it runs with
// viewport-fit=cover, so the home-screen app on an iPhone reaches under the home indicator and into the corners).
// A value is a CSS calc(), which React Native's types don't know, hence the cast.
export type Edge = (extra?: number) => number;

const edge =
  (side: "top" | "bottom" | "left" | "right"): Edge =>
  (extra = 0) =>
    `calc(${extra}px + env(safe-area-inset-${side}, 0px))` as unknown as number;

const EDGES = { top: edge("top"), bottom: edge("bottom"), left: edge("left"), right: edge("right") };

export function useEdges(): typeof EDGES {
  return EDGES;
}
