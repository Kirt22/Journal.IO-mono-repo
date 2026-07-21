import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../theme/provider";

type ThemePreview = {
  id: string;
  label: string;
  primaryColor: string;
};

type ThemePreviewCardProps = {
  themeOption: ThemePreview;
  selected: boolean;
  onPress: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

export default function ThemePreviewCard({
  themeOption,
  selected,
  onPress,
  style,
}: ThemePreviewCardProps) {
  const theme = useTheme();
  const isDark = theme.mode === "dark";
  const cardBackground = selected
    ? hexToRgba(theme.colors.primary, isDark ? 0.2 : 0.13)
    : isDark
      ? hexToRgba(theme.colors.secondary, 0.78)
      : theme.colors.card;
  const cardBorder = selected
    ? hexToRgba(theme.colors.primary, isDark ? 0.68 : 0.4)
    : isDark
      ? hexToRgba(theme.colors.border, 0.9)
      : hexToRgba(theme.colors.border, 0.82);
  const swatchWrapBackground = isDark
    ? hexToRgba(theme.colors.background, 0.64)
    : theme.colors.secondary;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        style,
        {
          backgroundColor: cardBackground,
          borderColor: cardBorder,
          shadowColor: theme.colors.primary,
          shadowOpacity: selected ? (isDark ? 0.18 : 0.1) : isDark ? 0.08 : 0.04,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.swatchWrap, { backgroundColor: swatchWrapBackground }]}>
        <View
          accessibilityLabel={`${themeOption.label} primary color`}
          style={[styles.swatch, { backgroundColor: themeOption.primaryColor }]}
        />
      </View>
      <Text style={[styles.label, { color: theme.colors.foreground }]}>
        {themeOption.label}
      </Text>
    </Pressable>
  );
}

export type { ThemePreview };

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    aspectRatio: 1,
    borderRadius: 18,
    borderWidth: 1,
    gap: 9,
    justifyContent: "center",
    padding: 10,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowRadius: 18,
    width: "46%",
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  swatch: {
    borderColor: "rgba(111, 70, 50, 0.1)",
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    width: 34,
  },
  swatchWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
});
