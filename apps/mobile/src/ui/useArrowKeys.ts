// A phone has no arrow keys; the web's are in useArrowKeys.web.ts.
export function useArrowKeys(left: () => void, right: () => void) {
  void left;
  void right;
}
