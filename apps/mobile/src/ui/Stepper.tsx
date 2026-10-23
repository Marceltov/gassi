// The − and + for an amount or a count, one look everywhere: big beside an amount (the food sheet, an entry's grams
// or weight), small beside a count (a training's repetitions and treats).
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FIELD_HEIGHT, radius, useTheme } from "../theme";

type StepProps = { label: string; sign: "−" | "+"; disabled: boolean; small?: boolean; onPress: () => void };

export function StepButton({ label, sign, disabled, small, onPress }: StepProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [small ? styles.small : styles.big, { backgroundColor: small ? theme.neutral : theme.surface, boxShadow: disabled ? undefined : theme.calm, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Text style={[small ? styles.smallText : styles.bigText, { color: theme.ink }]}>{sign}</Text>
    </Pressable>
  );
}

/** An amount between − and +: `step` names one step for the screen reader ("10 g" weniger / mehr), `sub` what the
 * amount is of, under it ("je Hund"; `subTestID` names it for a test). */
export function AmountStepper({ value, sub, step, testID, subTestID, onStep, atMin, atMax }: { value: string; sub?: string; step: string; testID?: string; subTestID?: string; onStep: (d: 1 | -1) => void; atMin: boolean; atMax: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <StepButton label={`${step} weniger`} sign="−" disabled={atMin} onPress={() => onStep(-1)} />
      <View style={styles.middle}>
        <Text testID={testID} style={[styles.amount, { color: theme.ink }]}>
          {value}
        </Text>
        {sub ? (
          <Text testID={subTestID} style={[styles.sub, { color: theme.muted }]}>
            {sub}
          </Text>
        ) : null}
      </View>
      <StepButton label={`${step} mehr`} sign="+" disabled={atMax} onPress={() => onStep(1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  middle: { alignItems: "center" },
  amount: { fontSize: 30, fontWeight: "700" },
  sub: { fontSize: 13 },
  big: { width: FIELD_HEIGHT, height: FIELD_HEIGHT, borderRadius: radius.tile, alignItems: "center", justifyContent: "center" },
  bigText: { fontSize: 22, fontWeight: "700" },
  small: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  smallText: { fontSize: 20, fontWeight: "700" },
});
