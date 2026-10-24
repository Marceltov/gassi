// One of a walk's taps or trainings in a list (the running walk's, a summary's): its time, icon and line, cut short
// rather than wrapping, the time never squeezed. With `onPress` it is a button with a chevron (it opens the entry);
// `compact` keeps the running walk's dense lines, else a pressable row is a box (#99).
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";
import { hhmm } from "../time";
import { Icon } from "../ui/Icon";
import { TYPE_ICON, TYPE_TONE } from "../ui/icons";
import type { WalkItem } from "./lines";

type Props = { item: WalkItem; text: string; muted?: boolean; compact?: boolean; testID?: string; a11y?: string; onPress?: () => void };

export function ItemRow({ item, text, muted, compact, testID, a11y, onPress }: Props) {
  const theme = useTheme();
  const type = item.kind === "tap" ? item.tap.type : "training";
  const content = (
    <>
      <Text style={[styles.line, styles.time, { color: theme.muted }]}>{hhmm(item.at)}</Text>
      <Icon name={TYPE_ICON[type]} size={17} color={theme[TYPE_TONE[type]]} />
      <Text style={[styles.line, styles.text, { color: muted ? theme.muted : theme.ink }]} numberOfLines={1}>
        {text}
      </Text>
    </>
  );
  const shape = compact ? styles.compact : styles.box;
  if (!onPress) return <View style={[styles.row, shape]}>{content}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? `${hhmm(item.at)} ${text} ändern`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, shape, !compact && { backgroundColor: theme.neutral }, { opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
      <Icon name="next" size={compact ? 15 : 18} color={theme.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  compact: { minHeight: 28 },
  box: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, minHeight: 40 },
  line: { fontSize: 15 },
  time: { flexShrink: 0, fontVariant: ["tabular-nums"], minWidth: 40 },
  text: { flex: 1 },
});
