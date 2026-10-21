// Back from a Mehr screen: where it was opened from, or Mehr when it was opened directly (a reload, a deep link).
import { useRouter } from "expo-router";

export function useBack(): () => void {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace("/mehr"));
}
