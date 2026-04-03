import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "../infrastructure/reactNative";
import { useTheme } from "../theme/provider";
import type { ReactNode } from "react";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "solid" | "outline" | "ghost";
  tone?: "default" | "accent";
  icon?: ReactNode;
  size?: "md" | "sm";
};

const PrimaryButton = ({
  label,
  onPress,
  disabled,
  loading,
  variant = "solid",
  tone = "default",
  icon,
  size = "md",
}: PrimaryButtonProps) => {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const isOutline = variant === "outline";
  const isGhost = variant === "ghost";
  const isAccent = tone === "accent";
  const solidBackground = isAccent ? theme.colors.primary : theme.colors.success;
  const solidText = isAccent
    ? theme.colors.primaryForeground
    : theme.colors.successForeground;
  const outlineBackground = theme.colors.secondary;
  const outlineBorder = theme.colors.border;
  const outlineText = theme.colors.foreground;
  const ghostText = theme.colors.mutedForeground;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }: { pressed: boolean }) => [
        styles.button,
        size === "sm" && styles.buttonSmall,
        isGhost
          ? styles.buttonGhost
          : isOutline
            ? [
                styles.buttonOutline,
                {
                  backgroundColor: outlineBackground,
                  borderColor: outlineBorder,
                },
              ]
            : isAccent
              ? [styles.buttonSolid, { backgroundColor: solidBackground, borderColor: solidBackground }]
              : [styles.buttonSolid, { backgroundColor: solidBackground, borderColor: solidBackground }],
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost || isOutline ? outlineText : solidText} />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
          <Text
            style={[
              styles.labelBase,
              size === "sm" && styles.labelSmall,
              !isOutline && !isGhost && { color: solidText },
              isOutline && { color: outlineText },
              isGhost && { color: ghostText },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  buttonSmall: {
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonSolid: {},
  buttonOutline: {
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  labelBase: {
    fontSize: 16,
    fontWeight: "600",
  },
  labelSmall: {
    fontSize: 14,
  },
});

export default PrimaryButton;
