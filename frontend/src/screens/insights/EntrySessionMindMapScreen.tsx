import HapticPressable from '../../components/HapticPressable';
import {
  useCallback,
  useEffect,
  useState } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../../infrastructure/reactNative';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { GuidedReflectionSessionAnalysisResponse } from '../../services/guidedReflectionService';
import { getJournalSessionAnalysis } from '../../services/journalService';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../theme/provider';
import { ApiError } from '../../utils/apiClient';
import EntryMindMapScreen from './EntryMindMapScreen';
import OnboardingMindMapLoaderScreen from '../onboarding/OnboardingMindMapLoaderScreen';
import OnboardingMindMapScreen from '../onboarding/OnboardingMindMapScreen';

type Props = {
  initialSessionAnalysis?: GuidedReflectionSessionAnalysisResponse;
  journalId: string;
  onBack: () => void;
  onContinue: () => void;
  onUpgrade: () => void;
};

export default function EntrySessionMindMapScreen({
  initialSessionAnalysis,
  journalId,
  onBack,
  onContinue,
  onUpgrade,
}: Props) {
  const theme = useTheme();
  const isPremiumUser = useAppStore(state =>
    Boolean(state.session?.user.isPremium),
  );
  const [sessionAnalysis, setSessionAnalysis] =
    useState<GuidedReflectionSessionAnalysisResponse | null>(
      initialSessionAnalysis ?? null,
    );
  const [isLoading, setIsLoading] = useState(
    isPremiumUser && !initialSessionAnalysis,
  );
  const [loaderComplete, setLoaderComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useExistingGate, setUseExistingGate] = useState(!isPremiumUser);

  const loadSessionAnalysis = useCallback(async () => {
    if (!isPremiumUser) {
      setUseExistingGate(true);
      setIsLoading(false);
      return;
    }

    if (initialSessionAnalysis) {
      setSessionAnalysis(initialSessionAnalysis);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setSessionAnalysis(await getJournalSessionAnalysis(journalId));
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        caught.code === 'PREMIUM_REQUIRED'
      ) {
        setUseExistingGate(true);
      } else {
        setError(
          "We couldn't prepare this session Mind Map right now. Your entry is already safe.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [initialSessionAnalysis, isPremiumUser, journalId]);

  useEffect(() => {
    loadSessionAnalysis().catch(() => undefined);
  }, [loadSessionAnalysis]);

  const handleLoaderComplete = useCallback(() => {
    setLoaderComplete(true);
  }, []);

  const handleRetry = () => {
    setLoaderComplete(false);
    loadSessionAnalysis().catch(() => undefined);
  };

  if (useExistingGate) {
    return (
      <EntryMindMapScreen
        journalId={journalId}
        onBack={onBack}
        onContinue={onContinue}
        onUpgrade={onUpgrade}
      />
    );
  }

  if (!loaderComplete || isLoading) {
    return (
      <OnboardingMindMapLoaderScreen
        onComplete={handleLoaderComplete}
        variant="session"
      />
    );
  }

  if (error || !sessionAnalysis) {
    return (
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.errorContent}>
          <Text style={[styles.errorTitle, { color: theme.colors.foreground }]}>
            Your entry is safe
          </Text>
          <Text
            style={[styles.errorBody, { color: theme.colors.mutedForeground }]}
          >
            {error}
          </Text>
          <HapticPressable
            accessibilityLabel="Try session Mind Map again"
            accessibilityRole="button"
            onPress={handleRetry}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                { color: theme.colors.primaryForeground },
              ]}
            >
              Try again
            </Text>
          </HapticPressable>
          <HapticPressable
            accessibilityLabel="Return Home without session Mind Map"
            accessibilityRole="button"
            onPress={onContinue}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                { color: theme.colors.foreground },
              ]}
            >
              Return Home
            </Text>
          </HapticPressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <OnboardingMindMapScreen
      onContinue={onContinue}
      sessionAnalysis={sessionAnalysis}
      variant="session"
    />
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  errorContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  errorTitle: {
    fontSize: 24,
    letterSpacing: -0.5,
    fontWeight: '700',
    lineHeight: 30,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 330,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 52,
    paddingHorizontal: 30,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },
});
