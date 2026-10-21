// Nass | Trocken, for the switches (ui/Segments.tsx) on the food sheet, an entry's detail and Vorrat.
import { FOOD_KINDS, FOOD_SHORT, type FoodKind } from "@gassi/domain";

export const FOOD_KIND_OPTIONS: readonly { value: FoodKind; label: string }[] = FOOD_KINDS.map((k) => ({ value: k, label: FOOD_SHORT[k] }));
