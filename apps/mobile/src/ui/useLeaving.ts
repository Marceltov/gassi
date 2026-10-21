// Leaving a screen (a push, a replace) happens once, also on a double tap before the next screen is up: `leave(go)`
// runs `go` only the first time until the screen is focused again; `isLeaving()` tells whether it is on its way.
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

export function useLeaving(): { leave: (go: () => void) => void; isLeaving: () => boolean } {
  const leaving = useRef(false);
  useFocusEffect(
    useCallback(() => {
      leaving.current = false;
    }, []),
  );
  const leave = useCallback((go: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    go();
  }, []);
  const isLeaving = useCallback(() => leaving.current, []);
  return { leave, isLeaving };
}
