// Futter geben: a sheet pre-filled with the newest feeding (kind and grams), a switch for wet or dry, − and + in 10 g
// steps, quick amounts, the stock, and one tap on Eintragen. All dogs unless some are switched off. It opens at once
// from what was kept, and Eintragen goes through the queue, so it works without reception.
import { clampPortion, FOOD_MAX_G, type FoodKind, newId, portionFor, prefillFood, quickPortions, stockLine } from "@gassi/domain";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { radius, useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Chip } from "../ui/Chip";
import { Sheet } from "../ui/Sheet";
import { type FoodFacts, loadFacts, RECENT, saveFacts, withFeeding } from "./memory";

const STEP_G = 10;
const KINDS: { kind: FoodKind; label: string }[] = [
  { kind: "wet", label: "Nass" },
  { kind: "dry", label: "Trocken" },
];

export function FoodSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
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

  const quick = quickPortions(facts.recent, kind, facts.stock?.wet.canSizeG ?? null);
  const stock = facts.stock ? stockLine(facts.stock, kind) : null;
  const submit = () => {
    send({ id: submitId, at: new Date().toISOString(), kind: "food", foodKind: kind, amountG, ...(chosen.length < active.length ? { dogIds: chosen.map((d) => d.id) } : {}) });
    // the next opening (maybe without reception) starts from this feeding, as it would from the server's answer
    saveFacts(personId, withFeeding(facts, { foodKind: kind, amountG }));
    onClose();
  };

  return (
    <View testID="food-sheet" style={styles.form}>
      <Text style={[styles.title, { color: theme.ink }]}>{active.length === 1 ? `Futter für ${active[0].name}` : "Futter geben"}</Text>
      <View style={[styles.switch, { backgroundColor: theme.background, borderColor: theme.line }]}>
        {KINDS.map((k) => (
          <Pressable
            key={k.kind}
            accessibilityRole="tab"
            accessibilityLabel={k.label}
            aria-selected={kind === k.kind}
            onPress={() => pick(k.kind)}
            style={[styles.segment, kind === k.kind && { backgroundColor: theme.food }]}
          >
            <Text style={[styles.segmentText, { color: kind === k.kind ? "#fff" : theme.muted }]}>{k.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.amountRow}>
        <Step label="10 g weniger" sign="−" disabled={amountG <= 1} onPress={() => set(amountG - STEP_G)} />
        <Text testID="food-amount" style={[styles.amount, { color: theme.ink }]}>{`${amountG} g`}</Text>
        <Step label="10 g mehr" sign="+" disabled={amountG >= FOOD_MAX_G} onPress={() => set(amountG + STEP_G)} />
      </View>
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
            <Chip key={d.id} label={d.name} color={d.color} on={!off.includes(d.id)} onPress={() => toggleDog(d.id)} />
          ))}
        </View>
      ) : null}
      {stock ? <Text testID="food-stock" style={[styles.stock, { color: theme.muted }]}>{stock}</Text> : null}
      <BigButton kind="food" size="l" label="Eintragen" onPress={submit} />
    </View>
  );
}

function Step({ label, sign, disabled, onPress }: { label: string; sign: string; disabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.step, { backgroundColor: theme.surface, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.stepText, { color: theme.ink }]}>{sign}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  title: { fontSize: 17, fontWeight: "700" },
  switch: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 3 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10 },
  segmentText: { fontSize: 14, fontWeight: "700" },
  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  amount: { fontSize: 30, fontWeight: "700" },
  step: { width: 56, height: 56, borderRadius: radius.tile, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 26, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quick: { flexGrow: 1, alignItems: "center", borderRadius: 10, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 10 },
  quickText: { fontSize: 14, fontWeight: "600" },
  stock: { fontSize: 12, textAlign: "center" },
});
