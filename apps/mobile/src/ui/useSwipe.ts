// A sideways swipe across a screen (Woche: the week before and after). It takes over only from a move that is clearly
// sideways, so the page still scrolls up and down, and not on a part marked `data-noswipe` (a map, dragged itself).
import { useMemo } from "react";
import { type GestureResponderEvent, PanResponder } from "react-native";

const START = 20; // px sideways before it counts as a swipe
const DISTANCE = 50; // px sideways to go on

const onNoSwipe = (e: GestureResponderEvent) => {
  const target = e.nativeEvent.target as unknown;
  return typeof Element !== "undefined" && target instanceof Element && !!target.closest("[data-noswipe]");
};

/** `toLeft`: the finger moved to the left (the next page); `toRight`: to the right (the one before). Pass stable
 * callbacks (useCallback). */
export function useSwipe(toLeft: () => void, toRight: () => void) {
  return useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > START && Math.abs(g.dx) > 2 * Math.abs(g.dy) && !onNoSwipe(e),
        onPanResponderRelease: (_, g) => {
          if (g.dx <= -DISTANCE) toLeft();
          else if (g.dx >= DISTANCE) toRight();
        },
      }).panHandlers,
    [toLeft, toRight],
  );
}
