import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityRole,
  type ViewStyle,
} from "react-native";
import { Check, Circle } from "lucide-react-native";
import { useTheme } from "../theme/provider";

type OnboardingOptionCardProps = {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  multiSelect?: boolean;
  compact?: boolean;
  accessibilityRole?: AccessibilityRole;
  leadingIcon?: ReactNode;
  style?: ViewStyle;
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

export default function OnboardingOptionCard({
  label,
  description,
  selected,
  onPress,
  multiSelect = false,
  compact = false,
  accessibilityRole,
  leadingIcon,
  style,
}: OnboardingOptionCardProps) {
  const theme = useTheme();
  const selectedScale = useRef(new Animated.Value(selected ? 1.01 : 1)).current;
  const isDark = theme.mode === "dark";
  const cardBackground = selected
    ? hexToRgba(theme.colors.primary, isDark ? 0.18 : 0.14)
    : isDark
      ? hexToRgba(theme.colors.secondary, 0.74)
      : theme.colors.card;
  const cardBorder = selected
    ? hexToRgba(theme.colors.primary, isDark ? 0.62 : 0.42)
    : isDark
      ? hexToRgba(theme.colors.border, 0.95)
      : hexToRgba(theme.colors.border, 0.85);
  const markBackground = selected
    ? theme.colors.primary
    : isDark
      ? hexToRgba(theme.colors.background, 0.58)
      : theme.colors.secondary;
  const markBorder = selected
    ? theme.colors.primary
    : hexToRgba(theme.colors.mutedForeground, isDark ? 0.42 : 0.32);

  useEffect(() => {
    Animated.spring(selectedScale, {
      toValue: selected ? 1.01 : 1,
      damping: 16,
      stiffness: 260,
      mass: 0.75,
      useNativeDriver: true,
    }).start();
  }, [selected, selectedScale]);

  return (
    <Animated.View style={[{ transform: [{ scale: selectedScale }] }, style]}>
      <Pressable
        accessibilityRole={accessibilityRole || (multiSelect ? "checkbox" : "radio")}
        accessibilityState={multiSelect ? { checked: selected } : { selected }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          compact && styles.compactCard,
          {
            backgroundColor: cardBackground,
            borderColor: cardBorder,
            shadowColor: theme.colors.primary,
            shadowOpacity: selected ? (isDark ? 0.18 : 0.1) : isDark ? 0.08 : 0.04,
          },
          pressed && styles.pressed,
        ]}
      >
        {leadingIcon ? <View style={styles.leadingIcon}>{leadingIcon}</View> : null}
        <View style={styles.copyWrap}>
          <Text style={[styles.label, { color: theme.colors.foreground }]}>
            {label}
          </Text>
          {description ? (
            <Text
              style={[
                styles.description,
                { color: theme.colors.mutedForeground },
              ]}
            >
              {description}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.selectionMark,
            {
              borderColor: markBorder,
              backgroundColor: markBackground,
            },
          ]}
        >
          {selected ? (
            <Check color={theme.colors.primaryForeground} size={12} strokeWidth={3} />
          ) : (
            <Circle color="transparent" size={8} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowRadius: 14,
  },
  compactCard: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  copyWrap: {
    flex: 1,
    gap: 2,
  },
  description: {
    fontSize: 11,
    lineHeight: 15,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
  leadingIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  selectionMark: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 19,
    justifyContent: "center",
    width: 19,
  },
});
