import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from "../infrastructure/reactNative";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "solid" | "outline" | "ghost";
};

const PrimaryButton = ({
  label,
  onPress,
  disabled,
  loading,
  variant = "solid",
}: PrimaryButtonProps) => {
  const isDisabled = disabled || loading;
  const isOutline = variant === "outline";
  const isGhost = variant === "ghost";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }: { pressed: boolean }) => [
        styles.button,
        isGhost
          ? styles.buttonGhost
          : isOutline
            ? styles.buttonOutline
            : styles.buttonSolid,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost || isOutline ? "#1C221B" : "#FFFFFF"} />
      ) : (
        <Text
          style={[
            styles.label,
            (isOutline || isGhost) && styles.labelOutline,
            isGhost && styles.labelGhost,
          ]}
        >
          {label}
        </Text>
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
  buttonSolid: {
    backgroundColor: "#2F7A5D",
    borderColor: "#2F7A5D",
  },
  buttonOutline: {
    backgroundColor: "#F1F2EC",
    borderColor: "#D7DCD2",
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
  label: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  labelOutline: {
    color: "#1C221B",
  },
  labelGhost: {
    color: "#556055",
    fontSize: 15,
  },
});

export default PrimaryButton;
