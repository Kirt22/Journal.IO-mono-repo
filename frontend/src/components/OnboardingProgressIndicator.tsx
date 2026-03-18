import { StyleSheet, View } from 'react-native';

type OnboardingProgressIndicatorProps = {
  currentStep: number;
  totalSteps: number;
};

export function OnboardingProgressIndicator({
  currentStep,
  totalSteps,
}: OnboardingProgressIndicatorProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isActive = index + 1 <= currentStep;
        return (
          <View
            key={`progress-step-${index + 1}`}
            style={[styles.track, isActive ? styles.activeTrack : styles.inactiveTrack]}
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
  activeTrack: {
    backgroundColor: '#E88B73',
  },
  inactiveTrack: {
    backgroundColor: '#D9DDD2',
  },
});
