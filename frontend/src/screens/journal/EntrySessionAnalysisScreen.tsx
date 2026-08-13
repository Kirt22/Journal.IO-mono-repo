import HapticPressable from '../../components/HapticPressable';
import {
  useCallback,
  useEffect,
  useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  Text,
} from '../../infrastructure/reactNative';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getGoalSuggestions } from '../../services/goalsService';
import { getJournalSessionAnalysis } from '../../services/journalService';
import type { GuidedReflectionSessionAnalysisResponse } from '../../services/guidedReflectionService';
import { toGuidedGoalSuggestions } from '../../utils/guidedGoalSuggestions';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../theme/provider';
import FirstGuidedReflectionScreen, {
  type FirstReflectionAnalysisPayload,
  type FirstReflectionGoalsPayload,
} from '../onboarding/FirstGuidedReflectionScreen';
import SessionAnalysisScreen from './SessionAnalysisScreen';
import JournalLoader from '../../components/JournalLoader';

type EntrySessionAnalysisScreenProps = {
  journalId: string;
  /**
   * Fetched inline while the entry saved. When present the screen renders
   * immediately — no loading beat — which is what lets the reveal animation
   * actually play instead of running behind a screen transition.
   */
  initialAnalysis?: GuidedReflectionSessionAnalysisResponse;
  onContinue: (analysis?: GuidedReflectionSessionAnalysisResponse) => void;
  onExit: () => void;
  onGoalsReady: (payload: FirstReflectionGoalsPayload) => void;
  onUpgrade: () => void;
};

/**
 * Open-ended entries have no guided prompt answers, but the guided analysis
 * renderer only needs the analysis itself — the empty answers are the shape it
 * expects for its fallbacks.
 */
export function toAnalysisPayload(
  journalId: string,
  analysis: GuidedReflectionSessionAnalysisResponse,
): FirstReflectionAnalysisPayload {
  return {
    answers: { good_exciting: '', hurdle: '', carry_tomorrow: '' },
    aiSummary: analysis.analysis,
    draft: { version: 2 },
    journalId,
    sessionAnalysis: analysis,
    threadMessages: [],
  };
}

export default function EntrySessionAnalysisScreen({
  journalId,
  initialAnalysis,
  onContinue,
  onExit,
  onGoalsReady,
  onUpgrade,
}: EntrySessionAnalysisScreenProps) {
  const theme = useTheme();
  const isPremium = useAppStore(state =>
    Boolean(state.session?.user.isPremium),
  );
  const [analysis, setAnalysis] =
    useState<GuidedReflectionSessionAnalysisResponse | null>(
      initialAnalysis ?? null,
    );
  const [isLoading, setIsLoading] = useState(isPremium && !initialAnalysis);
  const [error, setError] = useState<string | null>(null);

  // The guided goal-suggestion endpoint requires three prompt answers, which an
  // open-ended entry does not have, so the journal-id endpoint stands in.
  const loadGoalSuggestions = useCallback(async () => {
    const response = await getGoalSuggestions(journalId);
    return toGuidedGoalSuggestions(response.suggestions);
  }, [journalId]);

  const loadAnalysis = useCallback(async () => {
    if (!isPremium) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setAnalysis(await getJournalSessionAnalysis(journalId));
    } catch {
      setError(
        "We couldn't prepare this analysis right now. Your entry is already safe.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isPremium, journalId]);

  useEffect(() => {
    // Only the paths that arrive without a seeded analysis need to fetch.
    if (analysis) {
      return;
    }

    loadAnalysis().catch(() => undefined);
  }, [analysis, loadAnalysis]);

  if (!isPremium) {
    return (
      <SessionAnalysisScreen
        locked
        onContinue={() => onContinue(undefined)}
        onSecondary={onExit}
        onUpgrade={onUpgrade}
      />
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: theme.colors.background }]}
      >
        <JournalLoader color={theme.colors.primary} />
        <Text
          style={[styles.statusText, { color: theme.colors.mutedForeground }]}
        >
          Noticing the clearest patterns...
        </Text>
      </SafeAreaView>
    );
  }

  if (error || !analysis) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: theme.colors.background }]}
      >
        <Text style={[styles.errorTitle, { color: theme.colors.foreground }]}>
          Your entry is saved
        </Text>
        <Text
          style={[styles.statusText, { color: theme.colors.mutedForeground }]}
        >
          {error}
        </Text>
        <HapticPressable
          accessibilityLabel="Try session analysis again"
          accessibilityRole="button"
          onPress={() => loadAnalysis().catch(() => undefined)}
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: theme.colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.retryText,
              { color: theme.colors.primaryForeground },
            ]}
          >
            Try again
          </Text>
        </HapticPressable>
        <HapticPressable
          accessibilityLabel="Continue without analysis"
          accessibilityRole="button"
          onPress={() => onContinue(undefined)}
          style={styles.skipButton}
        >
          <Text style={[styles.skipText, { color: theme.colors.foreground }]}>
            Continue without analysis
          </Text>
        </HapticPressable>
      </SafeAreaView>
    );
  }

  // Same renderer the guided flow uses, so the typewriter + staggered card
  // reveal and the inline "Continue to goals" loader are identical here.
  return (
    <FirstGuidedReflectionScreen
      draft={{ version: 2 }}
      initialAnalysisPayload={toAnalysisPayload(journalId, analysis)}
      loadGoalSuggestionsOverride={loadGoalSuggestions}
      onBackToReady={onExit}
      onGoalsReady={onGoalsReady}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    maxWidth: 330,
    textAlign: 'center',
  },
  errorTitle: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  retryButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 50,
    paddingHorizontal: 28,
  },
  retryText: { fontSize: 14, fontWeight: '600' },
  skipButton: { minHeight: 46, paddingHorizontal: 18, paddingTop: 14 },
  skipText: { fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
});
