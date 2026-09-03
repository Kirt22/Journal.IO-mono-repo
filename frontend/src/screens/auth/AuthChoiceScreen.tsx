import HapticPressable from '../../components/HapticPressable';
import {
  useCallback,
  useEffect,
  useRef,
  useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from '../../infrastructure/reactNative';
import {
  SafeAreaView } from 'react-native-safe-area-context';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import appleAuth from '@invertase/react-native-apple-authentication';
import PrimaryButton from '../../components/PrimaryButton';
import AuthActionIcon from '../../components/AuthActionIcon';
import { AuthErrorDialog } from '../../components/AuthErrorFeedback';
import AuthHero from '../../components/AuthHero';
import AuthInkBackdrop from '../../components/AuthInkBackdrop';
import type { JournalWordmarkIntroResult } from '../../components/JournalWordmark';
import { useTheme } from '../../theme/provider';
import { Path, Svg } from 'react-native-svg';
import { triggerHaptic, type HapticEvent } from '../../services/hapticsService';
import { getAuthLayoutMetrics } from './authLayout';
import {
  getAuthErrorPresentation,
  type AuthErrorContext,
} from './authErrorPresentation';

type AuthChoiceScreenProps = {
  onContinueWithEmail: () => Promise<void>;
  onContinueWithApple: () => Promise<void>;
  onContinueWithGoogle: () => Promise<void>;
  onGoToSignIn: () => void;
  animateEntrance?: boolean;
};

type AuthDialogState = {
  message: string;
  retry?: () => void;
  title: string;
};

const ACTION_LAYER_COUNT = 2;
const PRIMARY_LAYER_DURATION = 360;
const SECONDARY_LAYER_DELAY = 80;
const SECONDARY_LAYER_DURATION = 420;
const ACTION_REVEAL_SAFETY_DELAY = 3600;
const TRAVEL_HAPTIC_DELAY = 480;

export default function AuthChoiceScreen({
  onContinueWithEmail,
  onContinueWithApple,
  onContinueWithGoogle,
  onGoToSignIn,
  animateEntrance = typeof jest === 'undefined',
}: AuthChoiceScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [dialogError, setDialogError] = useState<AuthDialogState | null>(null);
  const shouldAnimateEntrance = animateEntrance;
  const actionEntrances = useRef(
    Array.from(
      { length: ACTION_LAYER_COUNT },
      () => new Animated.Value(shouldAnimateEntrance ? 0 : 1),
    ),
  ).current;
  const backdropProgress = useRef(
    new Animated.Value(shouldAnimateEntrance ? 0 : 1),
  ).current;
  const revealAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const backdropAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const entranceHapticTimeoutsRef = useRef<
    Array<ReturnType<typeof setTimeout>>
  >([]);
  const hasHandledMergeResultRef = useRef(false);
  const hasStartedActionRevealRef = useRef(!shouldAnimateEntrance);
  const actionRevealCancelledRef = useRef(false);
  const [areActionsInteractive, setAreActionsInteractive] = useState(
    !shouldAnimateEntrance,
  );
  const {
    contentPaddingBottom,
    contentPaddingTop,
    heroSubtitleMaxWidth,
    heroTitleSize,
    horizontalPadding,
    isVeryCompact,
    sheetMaxWidth,
  } = getAuthLayoutMetrics(width);
  const contentJustificationStyle = isVeryCompact
    ? styles.contentTopAligned
    : styles.contentCentered;
  const showAppleSignIn = Platform.OS === 'ios' && appleAuth.isSupported;
  const isAnyAuthLoading = isEmailLoading || isAppleLoading || isGoogleLoading;
  const actionEntranceStyles = actionEntrances.map((progress, index) => ({
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [index === 0 ? 12 : 16, 0],
        }),
      },
    ],
  }));

  const clearEntranceHapticTimers = useCallback(() => {
    entranceHapticTimeoutsRef.current.forEach(clearTimeout);
    entranceHapticTimeoutsRef.current = [];
  }, []);

  const scheduleEntranceHaptic = useCallback(
    (event: HapticEvent, delay: number) => {
      const timeout = setTimeout(() => {
        entranceHapticTimeoutsRef.current =
          entranceHapticTimeoutsRef.current.filter(
            activeTimeout => activeTimeout !== timeout,
          );
        triggerHaptic(event).catch(() => undefined);
      }, delay);

      entranceHapticTimeoutsRef.current.push(timeout);
    },
    [],
  );

  const forceRevealActions = useCallback(() => {
    hasStartedActionRevealRef.current = true;
    actionRevealCancelledRef.current = true;
    clearEntranceHapticTimers();
    backdropAnimationRef.current?.stop();
    revealAnimationRef.current?.stop();
    backdropProgress.setValue(1);
    actionEntrances.forEach(progress => progress.setValue(1));
    setAreActionsInteractive(true);
  }, [actionEntrances, backdropProgress, clearEntranceHapticTimers]);

  const handleWordmarkIntroStart = useCallback(() => {
    clearEntranceHapticTimers();
    backdropAnimationRef.current?.stop();
    backdropProgress.setValue(0);
    backdropAnimationRef.current = Animated.timing(backdropProgress, {
      toValue: 1,
      duration: 720,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    backdropAnimationRef.current.start();
    scheduleEntranceHaptic('authIntroProgress', TRAVEL_HAPTIC_DELAY);
  }, [backdropProgress, clearEntranceHapticTimers, scheduleEntranceHaptic]);

  const handleWordmarkMergeComplete = useCallback(
    (result: JournalWordmarkIntroResult) => {
      if (hasHandledMergeResultRef.current) {
        return;
      }

      hasHandledMergeResultRef.current = true;
      clearEntranceHapticTimers();
      backdropAnimationRef.current?.stop();
      backdropProgress.setValue(1);

      if (result.outcome === 'completed') {
        triggerHaptic('authIntroMerge').catch(() => undefined);
      } else if (result.outcome === 'reduced-motion') {
        triggerHaptic('authIntroWelcome').catch(() => undefined);
      }
    },
    [backdropProgress, clearEntranceHapticTimers],
  );

  const revealActions = useCallback(
    (result: JournalWordmarkIntroResult) => {
      if (!shouldAnimateEntrance || !result.animated) {
        forceRevealActions();
        return;
      }

      if (hasStartedActionRevealRef.current) {
        return;
      }

      hasStartedActionRevealRef.current = true;
      actionRevealCancelledRef.current = false;

      const animation = Animated.parallel([
        Animated.timing(actionEntrances[0], {
          toValue: 1,
          duration: PRIMARY_LAYER_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(SECONDARY_LAYER_DELAY),
          Animated.timing(actionEntrances[1], {
            toValue: 1,
            duration: SECONDARY_LAYER_DURATION,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]);
      revealAnimationRef.current = animation;
      animation.start(({ finished }) => {
        if (finished && !actionRevealCancelledRef.current) {
          clearEntranceHapticTimers();
          setAreActionsInteractive(true);
          triggerHaptic('authIntroReveal').catch(() => undefined);
        }
      });
    },
    [
      actionEntrances,
      clearEntranceHapticTimers,
      forceRevealActions,
      shouldAnimateEntrance,
    ],
  );

  useEffect(() => {
    if (!shouldAnimateEntrance) {
      return;
    }

    const safetyTimeout = setTimeout(
      forceRevealActions,
      ACTION_REVEAL_SAFETY_DELAY,
    );

    return () => {
      clearTimeout(safetyTimeout);
      clearEntranceHapticTimers();
      backdropAnimationRef.current?.stop();
      revealAnimationRef.current?.stop();
    };
  }, [clearEntranceHapticTimers, forceRevealActions, shouldAnimateEntrance]);

  useEffect(() => {
    if (!shouldAnimateEntrance) {
      return;
    }

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      enabled => {
        if (enabled) {
          forceRevealActions();
        }
      },
    );

    return () => subscription.remove();
  }, [forceRevealActions, shouldAnimateEntrance]);

  const presentDialogError = (
    error: unknown,
    context: AuthErrorContext,
    retry?: () => void,
  ) => {
    const presentation = getAuthErrorPresentation(error, context);

    if (!presentation) {
      return;
    }

    setDialogError({
      message: presentation.message,
      retry,
      title: presentation.title || 'Something went wrong',
    });
  };

  const handleEmailPress = async () => {
    setIsEmailLoading(true);
    setDialogError(null);

    try {
      await onContinueWithEmail();
    } catch (submissionError) {
      presentDialogError(submissionError, 'email-choice');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleGooglePress = async () => {
    if (isAnyAuthLoading) {
      return;
    }

    setIsGoogleLoading(true);
    setDialogError(null);

    try {
      await onContinueWithGoogle();
    } catch (submissionError) {
      presentDialogError(submissionError, 'google', () => {
        handleGooglePress().catch(() => undefined);
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleApplePress = async () => {
    if (isAnyAuthLoading) {
      return;
    }

    setIsAppleLoading(true);
    setDialogError(null);

    try {
      await onContinueWithApple();
    } catch (submissionError) {
      presentDialogError(submissionError, 'apple', () => {
        handleApplePress().catch(() => undefined);
      });
    } finally {
      setIsAppleLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <AuthInkBackdrop progress={backdropProgress} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            contentJustificationStyle,
            {
              paddingBottom: contentPaddingBottom,
              paddingHorizontal: horizontalPadding,
              paddingTop: contentPaddingTop + 8,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.sheet, { maxWidth: sheetMaxWidth }]}>
            <View testID="auth-brand" style={styles.brandRaised}>
              <AuthHero
                title="Journal.IO"
                subtitle="Your personal journaling companion."
                subtitleMaxWidth={heroSubtitleMaxWidth}
                titleSize={heroTitleSize}
                playWordmarkIntro={shouldAnimateEntrance}
                onWordmarkIntroStart={handleWordmarkIntroStart}
                onWordmarkMergeComplete={handleWordmarkMergeComplete}
                onWordmarkIntroComplete={revealActions}
              />
            </View>

            <View
              testID="auth-actions"
              pointerEvents={areActionsInteractive ? 'auto' : 'none'}
              accessibilityElementsHidden={!areActionsInteractive}
              importantForAccessibility={
                areActionsInteractive ? 'auto' : 'no-hide-descendants'
              }
              style={styles.form}
            >
              <Animated.View
                testID="auth-primary-layer"
                style={[styles.actionLayer, actionEntranceStyles[0]]}
              >
                <View testID="auth-email-action" style={styles.actionGroup}>
                  <PrimaryButton
                    label="Continue with Email"
                    onPress={handleEmailPress}
                    loading={isEmailLoading}
                    disabled={isAnyAuthLoading}
                    icon={<AuthActionIcon kind="email" />}
                    tone="accent"
                  />
                </View>

                <View
                  testID="auth-sign-in-action"
                  style={[styles.actionGroup, styles.linkRow]}
                >
                  <Text
                    style={[
                      styles.linkText,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    Already have an account?
                  </Text>
                  <HapticPressable onPress={onGoToSignIn} style={styles.linkButton}>
                    <Text
                      style={[styles.linkText, { color: theme.colors.primary }]}
                    >
                      Sign in
                    </Text>
                  </HapticPressable>
                </View>
              </Animated.View>

              <Animated.View
                testID="auth-secondary-layer"
                style={[styles.actionLayer, actionEntranceStyles[1]]}
              >
                <View
                  testID="auth-divider"
                  style={[styles.actionGroup, styles.divider]}
                >
                  <View
                    style={[
                      styles.rule,
                      { backgroundColor: theme.colors.border },
                    ]}
                  />
                  <Text
                    style={[
                      styles.dividerText,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    or
                  </Text>
                  <View
                    style={[
                      styles.rule,
                      { backgroundColor: theme.colors.border },
                    ]}
                  />
                </View>

                <View
                  testID="auth-social-actions"
                  style={[styles.actionGroup, styles.socialActions]}
                >
                  <PrimaryButton
                    label="Continue with Google"
                    onPress={handleGooglePress}
                    loading={isGoogleLoading}
                    disabled={isAnyAuthLoading}
                    variant="outline"
                    icon={<GoogleMark />}
                  />

                  {showAppleSignIn ? (
                    <PrimaryButton
                      label="Continue with Apple"
                      onPress={handleApplePress}
                      loading={isAppleLoading}
                      disabled={isAnyAuthLoading}
                      tone="apple"
                      icon={<AppleMark />}
                    />
                  ) : null}
                </View>
              </Animated.View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <AuthErrorDialog
        dismissLabel={dialogError?.retry ? 'Not now' : 'Okay'}
        message={dialogError?.message || ''}
        onDismiss={() => setDialogError(null)}
        onRetry={
          dialogError?.retry
            ? () => {
                const retry = dialogError.retry;
                setDialogError(null);
                retry?.();
              }
            : undefined
        }
        title={dialogError?.title || 'Something went wrong'}
        visible={Boolean(dialogError)}
      />
    </SafeAreaView>
  );
}

function GoogleMark() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        fill="#EA4335"
      />
    </Svg>
  );
}

function AppleMark() {
  const theme = useTheme();

  return (
    <Svg width={16} height={16} viewBox="0 0 384 512" fill="none">
      <Path
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5 4 299.7 8.8 326.8 18.4 354c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75-17.9 31.1 0 47.6 17.9 75.5 17.9 48.6-.7 90.4-82.5 102.6-119.3-34.6-16.3-59.3-51.2-60-91.2ZM296.8 105.5c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.8-13.6 15.5-21.6 36-20.4 58.6 26.3 2 49.4-14.5 64.3-35.2Z"
        fill={theme.colors.appleForeground}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: 20,
    flexGrow: 1,
  },
  contentCentered: {
    justifyContent: 'center',
  },
  contentTopAligned: {
    justifyContent: 'flex-start',
  },
  sheet: {
    width: '100%',
    alignSelf: 'center',
  },
  brandRaised: {
    transform: [{ translateY: -28 }],
    zIndex: 2,
  },
  form: {
    width: '100%',
    marginTop: 4,
    gap: 16,
    zIndex: 1,
  },
  actionGroup: {
    width: '100%',
  },
  actionLayer: {
    gap: 16,
    width: '100%',
  },
  socialActions: {
    gap: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rule: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  linkButton: {
    paddingVertical: 2,
  },
  linkText: {
    fontSize: 14,
  },
});
