// Futter geben: a sheet pre-filled with the newest feeding (kind and grams per dog), a switch for wet or dry, − and + in
// 10 g steps per dog, quick amounts (recent portions per dog), the dogs, and one tap on Eintragen, which records what
// the dogs that are on get together. A feeding names no can: a can opened is its own entry ("+ Dose aufgemacht", a list
// of the sizes with how many closed cans are left; several, also of different sizes), one closed can less in Vorrat.
// All dogs unless some are switched off. It opens at once from what was kept, and Eintragen goes through the queue
// (each can, then the feeding), so it works without reception.
import { clampPortion, FOOD_MAX_G, type FoodKind, newId, openableSizes, perDog, portionFor, prefillFood, quickPortions } from "@gassi/domain";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { FIELD_HEIGHT, radius, useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Chip } from "../ui/Chip";
import { ChoiceList } from "../ui/ChoiceList";
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
  const [amountG, setAmountG] = useState(start.amountG); // per dog
  const chosenKind = useRef(start.foodKind); // the kind now, for the server's answer
  const [off, setOff] = useState<number[]>([]); // dogs switched off; none: all dogs
  const [opened, setOpened] = useState<number[]>([]); // the cans opened for this feeding, by size
  const [choosingCan, setChoosingCan] = useState(false);
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
        recent: entries ? entries.entries.flatMap((e) => (e.foodKind && e.amountG ? [{ foodKind: e.foodKind, amountG: perDog(e.amountG, e.dogIds.length) }] : [])).slice(0, RECENT) : kept.current.recent,
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
    setOpened([]); // only wet food comes in cans
    setAmountG(portionFor(next, facts.recent, facts.last));
  };
  // what they get together stays within what one feeding may have
  const most = Math.floor(FOOD_MAX_G / chosen.length);
  const set = (grams: number) => {
    edited.current = true;
    setAmountG(Math.min(most, clampPortion(grams)));
  };
  const portion = Math.min(most, amountG); // a dog switched on can lower what each may get
  const total = portion * chosen.length;

  const quick = quickPortions(facts.recent, kind);
  const openable = kind === "wet" && facts.stock ? openableSizes(facts.stock) : [];
  const submit = () => {
    const at = new Date().toISOString();
    // the cans first, as they were opened before the feeding: at the same time Verlauf (newest first) lists them under
    // it; each its own id from the form's, so a double tap opens none twice
    opened.forEach((unitG, i) => send({ id: `${submitId}-open-${i}`, at, kind: "can.open", unitG }));
    send({ id: submitId, at, kind: "food", foodKind: kind, amountG: total, ...(chosen.length < active.length ? { dogIds: chosen.map((d) => d.id) } : {}) });
    // the next opening (maybe without reception) starts from this feeding, as it would from the server's answer
    saveFacts(personId, withFeeding(facts, { foodKind: kind, amountG: portion }));
    onClose();
  };

  // the sizes take the sheet's place until one is chosen or Zurück leads back
  if (choosingCan)
    return (
      <View testID="food-sheet" style={styles.form}>
        <Text style={[styles.title, { color: theme.ink }]}>Welche Dose aufgemacht?</Text>
        <ChoiceList
          accent={theme.food}
          choices={openable.map((s) => ({
            key: s.unitG,
            label: `${s.unitG}-g-Dose`,
            detail: `noch ${s.cans}`,
            onPress: () => {
              setOpened([...opened, s.unitG]);
              setChoosingCan(false);
            },
          }))}
        />
        <BigButton kind="neutral" size="s" label="Zurück" onPress={() => setChoosingCan(false)} />
      </View>
    );
  return (
    <View testID="food-sheet" style={styles.form}>
      <Text style={[styles.title, { color: theme.ink }]}>{active.length === 1 ? `Futter für ${active[0].name}` : "Futter geben"}</Text>
      <Segments options={FOOD_KIND_OPTIONS} value={kind} onChange={pick} kind="food" />
      <AmountStepper testID="food-amount" value={`${portion} g`} sub={active.length > 1 ? "je Hund" : undefined} step={`${STEP_G} g`} onStep={(d) => set(portion + d * STEP_G)} atMin={portion <= 1} atMax={portion + STEP_G > most} />
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
      {opened.map((unitG, i) => (
        <View key={i} style={[styles.opened, { backgroundColor: theme.surface, borderColor: theme.food }]}>
          <Text style={[styles.openedText, { color: theme.ink }]}>{`${unitG}-g-Dose aufgemacht`}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${unitG}-g-Dose aufgemacht entfernen`} hitSlop={8} onPress={() => setOpened(opened.filter((_, j) => j !== i))}>
            <Text style={[styles.remove, { color: theme.muted }]}>×</Text>
          </Pressable>
        </View>
      ))}
      {openable.length ? <BigButton kind="neutral" size="s" label="+ Dose aufgemacht" onPress={() => setChoosingCan(true)} /> : null}
      <BigButton kind="food" size="m" icon="check" label="Eintragen" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  title: { fontSize: 17, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quick: { flexGrow: 1, alignItems: "center", borderRadius: 10, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 10 },
  quickText: { fontSize: 14, fontWeight: "600" },
  opened: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: FIELD_HEIGHT, borderRadius: radius.tile, borderWidth: 2, paddingHorizontal: 12 },
  openedText: { fontSize: 14, fontWeight: "600" },
  remove: { fontSize: 20, fontWeight: "700" },
});
