// "Which dog?" for a tap that is for one dog (Pipi, Poopoo, ✓/✗) when several are on the walk or training: the dogs
// as one list, like every choice sheet.
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";
import { ChoiceList } from "./ChoiceList";
import { Sheet } from "./Sheet";

type Props = { open: boolean; title: string; dogs: { id: number; name: string; color?: string }[]; onPick: (dogId: number) => void; onClose: () => void };

export function DogChoiceSheet({ open, title, dogs, onPick, onClose }: Props) {
  const theme = useTheme();
  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <View testID="dog-choice" style={styles.sheet}>
        <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
        <ChoiceList choices={dogs.map((d) => ({ key: d.id, label: d.name, color: d.color, onPress: () => onPick(d.id) }))} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: 10 },
  title: { fontSize: 17, fontWeight: "700" },
});
