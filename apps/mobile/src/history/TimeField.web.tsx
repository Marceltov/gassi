// A date and time in this phone's time zone, with the browser's own picker (datetime-local). Same props as
// TimeField.tsx; `value` and what `onChange` gets are ISO instants.
import { isLocalDateTime, localToUtc, utcToLocal } from "@gassi/domain";
import { useColorScheme } from "react-native";
import { useTheme } from "../theme";
import { TIME_ZONE } from "../time";

const FONT = "-apple-system, system-ui, Roboto, sans-serif";

export type TimeFieldProps = { label: string; value: string; onChange: (iso: string) => void };

export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === "light" ? "light" : "dark";
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0, fontFamily: FONT }}>
      <span style={{ fontSize: 13, color: theme.muted }}>{label}</span>
      <input
        type="datetime-local"
        aria-label={label}
        value={utcToLocal(Date.parse(value), TIME_ZONE)}
        onChange={(e) => {
          // a half-typed or cleared value is left alone
          if (isLocalDateTime(e.target.value)) onChange(new Date(localToUtc(e.target.value, TIME_ZONE)).toISOString());
        }}
        style={{ colorScheme: scheme, background: theme.surface, color: theme.ink, border: `1px solid ${theme.line}`, borderRadius: 12, padding: "10px 12px", fontSize: 16, fontFamily: FONT, minWidth: 0 }}
      />
    </label>
  );
}
