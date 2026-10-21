// "Which dog?" for a tap that is for one dog (Pipi, Poopoo, ✓/✗) when several are on the walk or training.
import { StyleSheet, Text, View } from "react-native";
import { type ButtonKind, useTheme } from "../theme";
import { BigButton } from "./BigButton";
import { Sheet } from "./Sheet";

type Props = { open: boolean; title: string; kind: ButtonKind; dogs: { id: number; name: string }[]; onPick: (dogId: number) => void; onClose: () => void };

export function DogChoiceSheet({ open, title, kind, dogs, onPick, onClose }: Props) {
  const theme = useTheme();
  return (
    <Sheet open={open} onClose={onClose}>
      <View testID="dog-choice" style={styles.sheet}>
        <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
        {dogs.map((d) => (
          <BigButton key={d.id} kind={kind} size="l" label={d.name} onPress={() => onPick(d.id)} />
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: 8 },
  title: { fontSize: 17, fontWeight: "700" },
});
