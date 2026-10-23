// A question in a sheet, its answers as one list (ChoiceList): which dog for a tap that is for one dog (Pipi, Poopoo,
// klappt / klappt nicht) when several are on the walk or training, how a poop was. A tap on an answer answers it.
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";
import { type Choice, ChoiceList } from "./ChoiceList";
import { Sheet } from "./Sheet";

type Props = { open: boolean; title: string; choices: readonly Choice[]; accent?: string; testID?: string; onClose: () => void };

export function ChoiceSheet({ open, title, choices, accent, testID, onClose }: Props) {
  const theme = useTheme();
  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <View testID={testID} style={styles.sheet}>
        <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
        <ChoiceList choices={choices} accent={accent} />
      </View>
    </Sheet>
  );
}

/** The dogs `ids` as answers, each with its color. */
export const dogChoices = (ids: readonly number[], dogs: readonly { id: number; name: string; color: string }[], onPick: (id: number) => void): Choice[] =>
  ids.map((id) => {
    const dog = dogs.find((d) => d.id === id);
    return { key: id, label: dog?.name ?? "Hund", color: dog?.color, onPress: () => onPick(id) };
  });

const styles = StyleSheet.create({
  sheet: { gap: 10 },
  title: { fontSize: 17, fontWeight: "700" },
});
