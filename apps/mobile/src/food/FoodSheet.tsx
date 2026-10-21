// Futter geben: a sheet pre-filled with the newest feeding (kind and grams), a switch for wet or dry, for wet food the
// can size it comes out of (pre-set to the last used one), − and + in 10 g steps, quick amounts (½ and 1 can of that
// size), the stock, and one tap on Eintragen. All dogs unless some are switched off. It opens at once
// from what was kept, and Eintragen goes through the queue, so it works without reception.
import { canChoices, clampPortion, FOOD_MAX_G, type FoodKind, newId, portionFor, prefillFood, quickPortions, stockLine } from "@gassi/domain";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Chip } from "../ui/Chip";
import { FOOD_KIND_OPTIONS } from "../ui/foodKinds";
import { Segments } from "../ui/Segments";
import { Sheet } from "../ui/Sheet";
import { AmountStepper } from "../ui/Stepper";
import { type FoodFacts, loadFacts, RECENT, saveFacts, withFeeding } from "./memory";

const STEP_G = 10;

export function FoodSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="Futter geben">
      {open ? <FoodForm onClose={onClose} /> : null}
    </Sheet>
  );
}

// Mounted anew at every opening, so it starts from the newest feeding again.
function FoodForm({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const { me, dogs, api, send } = useGassi();
  const personId = me?.id ?? "";
  const [facts, setFacts] = useState<FoodFacts>(() => loadFacts(personId));
  const start = prefillFood(facts.recent, facts.last);
  const [kind, setKind] = useState<FoodKind>(start.foodKind);
  const [amountG, setAmountG] = useState(start.amountG);
  const [unitG, setUnitG] = useState(() => canChoices(facts.stock, facts.last).preset); // the can it comes out of
  const unitPicked = useRef(false); // the person chose the can: the server's answer must not change it
  const chosenKind = useRef(start.foodKind); // the kind now, for the server's answer
  const [off, setOff] = useState<number[]>([]); // dogs switched off; none: all dogs
  const kept = useRef(facts); // what was kept at the opening, for what the server doesn't answer
  const kindPicked = useRef(false); // the person chose the kind: the server's answer must not change it
  const edited = useRef(false); // the person set the grams by hand: the server's answer must not change them
  const [submitId] = useState(newId); // one id per form: a double tap on Eintragen is one feeding

  useEffect(() => {
    if (!api) return;
    let alive = true;
    // each answer on its own: what doesn't come stays as it was kept
    void Promise.all([api.lastFood().catch(() => null), api.stock().catch(() => null), api.entries({ type: "food" }).catch(() => null)]).then(([last, stock, entries]) => {
      if (!alive || (!last && !stock && !entries)) return;
      const fresh: FoodFacts = {
        last: last ?? kept.current.last,
        stock: stock ?? kept.current.stock,
        recent: entries ? entries.entries.flatMap((e) => (e.foodKind && e.amountG ? [{ foodKind: e.foodKind, amountG: e.amountG }] : [])).slice(0, RECENT) : kept.current.recent,
      };
      saveFacts(personId, fresh);
      setFacts(fresh);
      const next = kindPicked.current ? null : prefillFood(fresh.recent, fresh.last);
      const nextKind = next?.foodKind ?? chosenKind.current;
      if (next) {
        chosenKind.current = next.foodKind;
        setKind(next.foodKind);
      }
      if (!edited.current) setAmountG(portionFor(nextKind, fresh.recent, fresh.last));
      if (!unitPicked.current) setUnitG(canChoices(fresh.stock, fresh.last).preset);
    });
    return () => {
      alive = false;
    };
    // once per opening: the kept facts are only the starting point
  }, [api, personId]);

  const active = dogs.filter((d) => !d.archived);
  const chosen = active.filter((d) => !off.includes(d.id));
  const toggleDog = (id: number) => {
    const next = off.includes(id) ? off.filter((o) => o !== id) : [...off, id];
    if (next.length < active.length) setOff(next); // at least one dog eats
  };
  const pick = (next: FoodKind) => {
    if (next === kind) return;
    kindPicked.current = true;
    edited.current = false; // the new kind starts from its own last portion
    chosenKind.current = next;
    setKind(next);
    setAmountG(portionFor(next, facts.recent, facts.last));
  };
  const set = (grams: number) => {
    edited.current = true;
    setAmountG(clampPortion(grams));
  };

  const cans = canChoices(facts.stock, facts.last).sizes;
  const can = kind === "wet" && unitG !== null && cans.includes(unitG) ? unitG : null;
  const pickCan = (next: number) => {
    unitPicked.current = true;
    setUnitG(next);
  };
  const quick = quickPortions(facts.recent, kind, can);
  const stock = facts.stock ? stockLine(facts.stock, kind) : null;
  const submit = () => {
    send({ id: submitId, at: new Date().toISOString(), kind: "food", foodKind: kind, amountG, ...(can ? { unitG: can } : {}), ...(chosen.length < active.length ? { dogIds: chosen.map((d) => d.id) } : {}) });
    // the next opening (maybe without reception) starts from this feeding, as it would from the server's answer
    saveFacts(personId, withFeeding(facts, { foodKind: kind, amountG }, can));
    onClose();
  };

  return (
    <View testID="food-sheet" style={styles.form}>
      <Text style={[styles.title, { color: theme.ink }]}>{active.length === 1 ? `Futter für ${active[0].name}` : "Futter geben"}</Text>
      <Segments options={FOOD_KIND_OPTIONS} value={kind} onChange={pick} kind="food" />
      {kind === "wet" && cans.length ? (
        <View testID="food-cans" style={styles.chips}>
          {cans.map((u) => (
            <Chip key={u} label={`${u}-g-Dose`} on={u === can} accent={theme.food} onPress={() => pickCan(u)} />
          ))}
        </View>
      ) : null}
      <AmountStepper testID="food-amount" value={`${amountG} g`} step={`${STEP_G} g`} onStep={(d) => set(amountG + d * STEP_G)} atMin={amountG <= 1} atMax={amountG >= FOOD_MAX_G} />
      {quick.length ? (
        <View style={styles.chips}>
          {quick.map((q) => (
            <Pressable key={q.label} accessibilityRole="button" accessibilityLabel={q.label} onPress={() => set(q.amountG)} style={[styles.quick, { backgroundColor: theme.background, borderColor: theme.line }]}>
              <Text style={[styles.quickText, { color: theme.ink }]}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {active.length > 1 ? (
        <View style={styles.chips}>
          {active.map((d) => (
            <Chip key={d.id} label={d.name} color={d.color} on={!off.includes(d.id)} accent={theme.food} onPress={() => toggleDog(d.id)} />
          ))}
        </View>
      ) : null}
      {stock ? <Text testID="food-stock" style={[styles.stock, { color: theme.muted }]}>{stock}</Text> : null}
      <BigButton kind="food" size="l" label="Eintragen" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  title: { fontSize: 17, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quick: { flexGrow: 1, alignItems: "center", borderRadius: 10, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 10 },
  quickText: { fontSize: 14, fontWeight: "600" },
  stock: { fontSize: 12, textAlign: "center" },
});
