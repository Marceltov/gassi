// A line with how repetitions went ("Sitz ✓3 ~1 ✗1", "Kommando · Warte ~"), its counts in their colors (#100): klappt
// green, geht so amber, klappt nicht grey, a zero faint. Only for lines of a command or training, so a "~" in a note
// stays as it is.
import { Text, type TextProps } from "react-native";
import { useTheme } from "../theme";
import { gradedParts } from "./gradeParts";

/** `plain`: the line as it is, for a cell or row that may or may not be about repetitions. */
export function Graded({ text, plain, ...props }: TextProps & { text: string; plain?: boolean }) {
  const theme = useTheme();
  return (
    <Text {...props}>
      {(plain ? [{ text }] : gradedParts(text)).map((p, i) =>
        p.grade ? (
          <Text key={i} style={{ color: theme.grade[p.zero ? "zero" : p.grade], fontWeight: "700" }}>
            {p.text}
          </Text>
        ) : (
          p.text
        ),
      )}
    </Text>
  );
}
