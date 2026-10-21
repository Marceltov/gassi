// Mehr's lists: rows in rounded groups, each a name with a short value on the right; tappable ones open something.
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, useTheme } from "../theme";
import { Icon, type IconName } from "../ui/Icon";

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      {title ? <Text style={[styles.title, { color: theme.muted }]}>{title}</Text> : null}
      <View style={[styles.group, { backgroundColor: theme.surface }]}>{children}</View>
    </View>
  );
}

type RowProps = { label: string; value?: string; icon?: IconName; dot?: string; onPress?: () => void; testID?: string; muted?: boolean; right?: ReactNode };

export function Row({ label, value, icon, dot, onPress, testID, muted, right }: RowProps) {
  const theme = useTheme();
  const content = (
    <>
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      {icon ? <Icon name={icon} size={20} color={theme.muted} /> : null}
      <Text style={[styles.label, { color: muted ? theme.muted : theme.ink }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={[styles.value, { color: theme.muted }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {onPress ? <Icon name="next" size={20} color={theme.muted} /> : null}
    </>
  );
  const style = [styles.row, { borderBottomColor: theme.line }];
  return onPress ? (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? 0.7 : 1 }]}>
      {content}
    </Pressable>
  ) : (
    <View testID={testID} style={style}>
      {content}
    </View>
  );
}

/** A small button inside a row ("Zurückziehen", "Abmelden"). */
export function Small({ label, a11y, onPress }: { label: string; a11y?: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y ?? label} onPress={onPress} style={({ pressed }) => [styles.small, { backgroundColor: theme.neutral, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[styles.smallText, { color: theme.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  small: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  smallText: { fontSize: 13, fontWeight: "600" },
  wrap: { gap: 4 },
  title: { fontSize: 13, marginLeft: 4, marginTop: 6 },
  group: { borderRadius: radius.tile + 2, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { fontSize: 15, flexShrink: 1 },
  value: { flex: 1, fontSize: 13, textAlign: "right" },
});
