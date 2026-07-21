import { StyleSheet, View } from "react-native";
import { useTheme } from "../theme/provider";

type OnboardingProgressDotsProps = {
  currentIndex: number;
  total: number;
  accentColor?: string;
};

export default function OnboardingProgressDots({
  currentIndex,
  total,
  accentColor,
}: OnboardingProgressDotsProps) {
  const theme = useTheme();
  const activeColor = accentColor || theme.colors.primary;

  return (
    <View
      accessibilityLabel="Onboarding progress"
      accessibilityRole="progressbar"
      style={styles.root}
    >
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === currentIndex;
        const isPast = index < currentIndex;

        return (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor:
                  isActive || isPast ? activeColor : theme.colors.border,
                opacity: isActive ? 1 : isPast ? 0.65 : 0.55,
                width: isActive ? 22 : 7,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    paddingVertical: 8,
  },
  dot: {
    borderRadius: 999,
    height: 7,
  },
});
