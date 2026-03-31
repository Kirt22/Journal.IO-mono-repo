import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/provider';

type OnboardingProgressIndicatorProps = {
  currentStep: number;
  totalSteps: number;
};

export function OnboardingProgressIndicator({
  currentStep,
  totalSteps,
}: OnboardingProgressIndicatorProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isActive = index + 1 <= currentStep;
        return (
          <View
            key={`progress-step-${index + 1}`}
            style={[
              styles.track,
              {
                backgroundColor: isActive ? theme.colors.primary : theme.colors.border,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  track: {
    flex: 1,
    borderRadius: 999,
    height: 6,
  },
});
