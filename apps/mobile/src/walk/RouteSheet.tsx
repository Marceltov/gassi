// The route so far (#104), from the pill on the walk: the map, Strecke, Dauer, Tempo and who records. On the phone
// that records, its own points as they come; on the others, the server's (asked when the sheet opens and every 30 s
// while it is open), and "Strecke hier aufnehmen" to take recording over (ADR 0014).
import { formatDistance, formatSpeed, pausedWithin, simplify, type TrackPoint, type WalkView } from "@gassi/domain";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { TrackMap } from "../map/TrackMap";
import { walkClock } from "../start/elapsed";
import { useNow } from "../start/useNow";
import { useTheme } from "../theme";
import { hintsSupported } from "../track/hints";
import { useRecording } from "../track/Recording";
import { BigButton } from "../ui/BigButton";
import { Sheet } from "../ui/Sheet";

const ASK_MS = 30_000;

// the server's route of the running walk while `open`, asked again every ASK_MS
function useServerRoute(walkKey: string, open: boolean): { points: TrackPoint[]; distanceM: number } | null {
  const { api } = useGassi();
  const [route, setRoute] = useState<{ points: TrackPoint[]; distanceM: number } | null>(null);
  useEffect(() => {
    if (!open || !api) return;
    const ask = () =>
      api.walkByKey({ key: walkKey }).then(
        ({ track }) => setRoute(track ? { points: track.points, distanceM: track.metrics.distanceM } : null),
        () => {}, // no reception or no walk yet: the last answer stays
      );
    void ask();
    const timer = setInterval(() => void ask(), ASK_MS);
    return () => clearInterval(timer);
  }, [api, walkKey, open]);
  return route;
}

export function RouteSheet({ walk, open, onClose }: { walk: WalkView; open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const now = useNow(1000);
  const recording = useRecording();
  const server = useServerRoute(walk.key, open && !recording.mine);
  const { points, distanceM } = recording.mine ? recording : (server ?? { points: [], distanceM: 0 });
  const nowIso = new Date(now).toISOString();
  const walkingS = (now - Date.parse(walk.startedAt) - pausedWithin(walk.pauses, walk.startedAt, nowIso)) / 1000;
  // the same list until the points change, not a new one at every tick of the clock (#139: the map drew itself anew)
  const routes = useMemo(() => [simplify(points, 500)], [points]);
  const who = recording.mine ? "dieses Gerät" : (recording.recorderName ?? "niemand");

  const stat = (label: string, value: string) => (
    <View style={styles.stat}>
      <Text style={[styles.value, { color: theme.ink }]}>{value}</Text>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
    </View>
  );
  return (
    <Sheet open={open} onClose={onClose} label="Strecke">
      <View testID="route-sheet" style={styles.sheet}>
        {points.length > 1 ? <TrackMap routes={routes} height={260} /> : <Text style={[styles.line, { color: theme.muted }]}>Noch keine Strecke</Text>}
        <View style={styles.stats}>
          {stat("Strecke", formatDistance(distanceM))}
          {stat("Dauer", walkClock(walk, now))}
          {stat("Tempo", walkingS > 0 ? formatSpeed(distanceM / walkingS) : "–")}
        </View>
        <Text style={[styles.line, { color: theme.muted }]}>{`Strecke: ${who}`}</Text>
        {recording.mine && recording.status === "denied" ? <Text style={[styles.line, { color: theme.warn }]}>Standort für diese Seite in den Browser-Einstellungen erlauben.</Text> : null}
        {recording.mine && recording.status === "rough" ? <Text style={[styles.line, { color: theme.warn }]}>{hintsSupported() ? "Nur ungefährer Standort – Standort auf „Immer zulassen“ stellen" : "Nur ungefährer Standort – genauen Standort erlauben"}</Text> : null}
        {recording.mine ? null : <BigButton kind="walk" size="m" icon="walk" label="Strecke hier aufnehmen" onPress={recording.takeOver} />}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: 10 },
  stats: { flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center" },
  value: { fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] },
  label: { fontSize: 13 },
  line: { fontSize: 14, textAlign: "center" },
});
