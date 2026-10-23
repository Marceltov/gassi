// The app's icons: the platform's own symbols through expo-symbols (SF Symbols on iOS, Material Symbols on Android
// and the web, where they come from a font served with the app, so they work offline too), in a theme color. An icon
// is never read out on its own: the button or row it sits in carries the words.
// Poopoo has no symbol on either side: it is a small pile drawn from three rounded outlines, in the same stroke.
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { type ColorValue, StyleSheet, View } from "react-native";
import { useTheme } from "../theme";

type PerPlatform = Exclude<SymbolViewProps["name"], string>;
const sym = (ios: NonNullable<PerPlatform["ios"]>, material: NonNullable<PerPlatform["web"]>): PerPlatform => ({ ios, android: material, web: material });

const SYMBOLS = {
  walk: sym("figure.walk", "directions_walk"),
  dog: sym("pawprint.fill", "pets"),
  pee: sym("drop.fill", "water_drop"),
  food: sym("fork.knife", "restaurant"),
  training: sym("target", "target"),
  pause: sym("pause.fill", "pause"),
  resume: sym("play.fill", "play_arrow"),
  home: sym("house.fill", "home"),
  weight: sym("scalemass.fill", "scale"),
  stock: sym("shippingbox.fill", "package_2"),
  restock: sym("cart.fill", "shopping_cart"),
  note: sym("note.text", "sticky_note_2"),
  people: sym("person.2.fill", "group"),
  phone: sym("iphone", "smartphone"),
  watch: sym("applewatch", "watch"),
  check: sym("checkmark", "check"),
  cross: sym("xmark", "close"),
  next: sym("chevron.right", "chevron_right"),
  back: sym("chevron.left", "chevron_left"),
  trash: sym("trash", "delete"),
  expand: sym("arrow.up.left.and.arrow.down.right", "open_in_full"),
  shrink: sym("arrow.down.right.and.arrow.up.left", "close_fullscreen"),
  add: sym("plus", "add"),
  invite: sym("person.badge.plus", "person_add"),
  treat: sym("gift.fill", "pet_supplies"),
  code: sym("chevron.left.forwardslash.chevron.right", "code"),
  signIn: sym("arrow.right.circle.fill", "login"),
  signOut: sym("rectangle.portrait.and.arrow.right", "logout"),
};

export type IconName = keyof typeof SYMBOLS | "poop";

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: ColorValue }) {
  const theme = useTheme();
  const tint = color ?? theme.ink;
  if (name === "poop") return <Pile size={size} color={tint} />;
  return <SymbolView name={SYMBOLS[name]} size={size} tintColor={tint} accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden />;
}

// Three rounded layers, widest at the bottom, each resting on the one below, and a small tip (fractions of the size).
const LAYERS = [
  { w: 0.92, h: 0.32 },
  { w: 0.7, h: 0.29 },
  { w: 0.46, h: 0.27 },
];

function Pile({ size, color }: { size: number; color: ColorValue }) {
  const stroke = Math.max(1.5, Math.round(size * 0.085 * 2) / 2);
  // each layer's bottom is the top of the one below, less a stroke so that the outlines meet
  const bottoms = LAYERS.map((_, i) => size * 0.06 + LAYERS.slice(0, i).reduce((sum, l) => sum + size * l.h - stroke, 0));
  const layers = LAYERS.map((l, i) => ({ width: size * l.w, height: size * l.h, left: (size * (1 - l.w)) / 2, bottom: bottoms[i] }));
  const top = layers[layers.length - 1];
  const bottom = top.bottom + top.height - stroke;
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: size, height: size }}>
      {layers.map((box, i) => (
        <View key={i} style={[styles.layer, box, { borderRadius: box.height / 2, borderWidth: stroke, borderColor: color }]} />
      ))}
      <View style={[styles.layer, { width: stroke * 1.4, height: size * 0.16, left: size * 0.53, bottom: bottom - stroke / 2, borderRadius: stroke, backgroundColor: color, transform: [{ rotate: "30deg" }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute" },
});
