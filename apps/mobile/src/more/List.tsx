// Mehr's lists: rows in rounded groups, each a name with a short value on the right; tappable ones open something.
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { onColor } from "../colors";
import { type ListTone, radius, useTheme } from "../theme";
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

type RowProps = { label: string; value?: string; icon?: IconName; tone?: ListTone; square?: string; dot?: string; onPress?: () => void; testID?: string; muted?: boolean; right?: ReactNode };

export function Row({ label, value, icon, tone, square, dot, onPress, testID, muted, right }: RowProps) {
  const theme = useTheme();
  const content = (
    <>
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      {icon ? (
        <View style={[styles.square, { backgroundColor: square ?? (tone ? theme[tone] : theme.neutral), opacity: muted ? 0.6 : 1 }]}>
          <Icon name={icon} size={17} color={square ? onColor(square) : tone ? "#fff" : theme.muted} />
        </View>
      ) : null}
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
/** `danger`: it takes something away (a device signed out, an invite withdrawn): outlined in red (#80). */
export function Small({ label, a11y, onPress, danger = false }: { label: string; a11y?: string; onPress: () => void; danger?: boolean }) {
  const theme = useTheme();
  const look = danger ? { backgroundColor: "transparent", borderWidth: 1.5, borderColor: theme.danger } : { backgroundColor: theme.neutral };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y ?? label} onPress={onPress} style={({ pressed }) => [styles.small, look, { opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[styles.smallText, { color: danger ? theme.danger : theme.ink }]}>{label}</Text>
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
  square: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { fontSize: 15, flexShrink: 1 },
  value: { flex: 1, fontSize: 13, textAlign: "right" },
});
