// ← and → on a keyboard while the screen is in front (Woche: the week before and after); not while typing in a field
// or while a sheet is open.
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

export function useArrowKeys(left: () => void, right: () => void) {
  useFocusEffect(
    useCallback(() => {
      const onKey = (event: KeyboardEvent) => {
        if (event.target instanceof Element && event.target.closest("input, textarea, [contenteditable]")) return;
        if (document.querySelector('[aria-modal="true"]')) return;
        if (event.key === "ArrowLeft") left();
        else if (event.key === "ArrowRight") right();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [left, right]),
  );
}
