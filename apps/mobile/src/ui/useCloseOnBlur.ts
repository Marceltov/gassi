// An open sheet closes when its screen loses the focus (another tab tapped, a push): it would otherwise stay over
// the next screen (the web's sheet lives in document.body) or come back open later.
import { useIsFocused } from "expo-router";
import { useEffect, useRef } from "react";

export function useCloseOnBlur(open: boolean, onClose: () => void): void {
  const focused = useIsFocused();
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (open && !focused) close.current();
  }, [open, focused]);
}
