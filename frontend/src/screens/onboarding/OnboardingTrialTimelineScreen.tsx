import HapticPressable from '../../components/HapticPressable';
import {
  Check } from 'lucide-react-native';
import { useCallback,
  useEffect,
  useRef,
  useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Linking,
  StyleSheet,
  View,
} from 'react-native';
import {
  SafeAreaView } from 'react-native-safe-area-context';
import ButtonLoadingContent from '../../components/ButtonLoadingContent';
import { Text,
} from '../../infrastructure/reactNative';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { triggerHaptic } from '../../services/hapticsService';
import {
  getReminderPermissionGranted,
  requestReminderPermission,
} from '../../services/reminderNotificationsService';
import {
  getCachedFreeTrialDays,
  getFreeTrialDays,
} from '../../services/revenueCatService';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../theme/provider';

type Props = {
  onContinue: () => Promise<void>;
};

// Mirrors the lead time baked into `scheduleFreeTrialEndingReminder`. If that
// offset ever moves, this copy has to move with it.
const TRIAL_REMINDER_LEAD_DAYS = 2;

export default function OnboardingTrialTimelineScreen({ onContinue }: Props) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const userId = useAppStore(state => state.session?.user.userId ?? null);

  const [trialDays, setTrialDays] = useState(() => getCachedFreeTrialDays());
  // `null` until the local permission read resolves; the copy stays soft until
  // then so we never promise a reminder we cannot send.
  const [hasNotificationPermission, setHasNotificationPermission] = useState<
    boolean | null
  >(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const nodeAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  // Each node nudges sideways as it lands, so the eye is walked down the
  // timeline one day at a time.
  const nodeShakes = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const footerAnim = useRef(new Animated.Value(0)).current;

  const refreshPermission = useCallback(async () => {
    try {
      const granted = await getReminderPermissionGranted();
      setHasNotificationPermission(granted);
    } catch {
      setHasNotificationPermission(false);
    }
  }, []);

  useEffect(() => {
    refreshPermission().catch(() => undefined);

    // Permission can change while the user is away in system Settings.
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        refreshPermission().catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [refreshPermission]);

  useEffect(() => {
    let isActive = true;

    getFreeTrialDays(userId)
      .then(days => {
        if (isActive) {
          setTrialDays(days);
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [userId]);

  useEffect(() => {
    let entrance: Animated.CompositeAnimation | null = null;

    if (reduceMotion) {
      nodeAnims.forEach(value => value.setValue(1));
      nodeShakes.forEach(value => value.setValue(0));
      footerAnim.setValue(1);
      return;
    }

    nodeAnims.forEach(value => value.setValue(0));
    nodeShakes.forEach(value => value.setValue(0));
    footerAnim.setValue(0);

    const shakeLeg = (
      value: Animated.Value,
      toValue: number,
      duration: number,
    ) =>
      Animated.timing(value, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });

    entrance = Animated.sequence([
      Animated.delay(160),
      // Staggered rather than strictly sequential: node 2 starts arriving while
      // node 1 is still settling, so the order stays unmistakable without the
      // screen taking three full beats to finish.
      Animated.stagger(
        420,
        nodeAnims.map((value, index) =>
          Animated.sequence([
            Animated.timing(value, {
              toValue: 1,
              duration: 380,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            shakeLeg(nodeShakes[index], 1, 60),
            shakeLeg(nodeShakes[index], -0.6, 80),
            shakeLeg(nodeShakes[index], 0.3, 70),
            shakeLeg(nodeShakes[index], 0, 80),
          ]),
        ),
      ),
      Animated.timing(footerAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    entrance.start();

    return () => entrance?.stop();
  }, [footerAnim, nodeAnims, nodeShakes, reduceMotion]);

  const handleEnableReminders = async () => {
    triggerHaptic('primaryAction').catch(() => undefined);

    try {
      const granted = await requestReminderPermission();

      if (granted) {
        setHasNotificationPermission(true);
        return;
      }

      // iOS only ever shows the system prompt once; after that the request
      // resolves denied with no UI, so send them to Settings instead.
      await Linking.openSettings();
    } catch {
      setHasNotificationPermission(false);
    }
  };

  const handleContinue = async () => {
    if (isFinishing) {
      return;
    }

    setIsFinishing(true);
    setFinishError(null);
    triggerHaptic('primaryAction').catch(() => undefined);

    try {
      await onContinue();
    } catch {
      // The reflection is already saved by this point, so offer a retry rather
      // than stranding the user on the last onboarding screen.
      setFinishError('Your reflection is saved. Please try continuing again.');
    } finally {
      setIsFinishing(false);
    }
  };

  const reminderDay = Math.max(1, trialDays - TRIAL_REMINDER_LEAD_DAYS);
  // Below this the reminder day collapses into the start and a day number
  // would be misleading, so the node drops it.
  const showReminderDay = trialDays > TRIAL_REMINDER_LEAD_DAYS + 1;
  const isPermissionGranted = hasNotificationPermission === true;

  const nodes = [
    {
      key: 'start',
      dayLabel: 'Day 1',
      title: 'Full access unlocked',
      body: 'Everything opens today. Nothing to set up.',
      isComplete: true,
    },
    {
      key: 'reminder',
      dayLabel: showReminderDay ? `Day ${reminderDay}` : 'Before it ends',
      title: isPermissionGranted ? "We'll remind you" : 'Set a reminder',
      body: isPermissionGranted
        ? `A heads-up ${TRIAL_REMINDER_LEAD_DAYS} days before your trial ends.`
        : `Turn on notifications and we'll warn you ${TRIAL_REMINDER_LEAD_DAYS} days before it ends.`,
      isComplete: false,
    },
    {
      key: 'end',
      dayLabel: `Day ${trialDays}`,
      title: 'Your trial ends',
      body: 'Cancel any time before this in Settings.',
      isComplete: false,
    },
  ];

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.screen}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.colors.foreground }]}>
            How your free trial works
          </Text>

          <View style={styles.timeline}>
            {nodes.map((node, index) => (
              <Animated.View
                key={node.key}
                style={[
                  styles.node,
                  {
                    opacity: nodeAnims[index],
                    transform: [
                      {
                        translateY: nodeAnims[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 0],
                        }),
                      },
                      {
                        // A sideways nudge, not a rotation — these rows are
                        // wide, and rotating one reads as a glitch.
                        translateX: nodeShakes[index].interpolate({
                          inputRange: [-1, 0, 1],
                          outputRange: [-5, 0, 5],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.rail}>
                  <View
                    style={[
                      styles.railDot,
                      {
                        backgroundColor: node.isComplete
                          ? theme.colors.primary
                          : theme.colors.card,
                        borderColor: node.isComplete
                          ? theme.colors.primary
                          : theme.colors.border,
                      },
                    ]}
                  >
                    {node.isComplete ? (
                      <Check
                        color={theme.colors.primaryForeground}
                        size={14}
                        strokeWidth={3}
                      />
                    ) : null}
                  </View>
                  {index < nodes.length - 1 ? (
                    <View
                      style={[
                        styles.railSegment,
                        { backgroundColor: theme.colors.border },
                      ]}
                    />
                  ) : null}
                </View>

                <View style={styles.nodeBody}>
                  <Text
                    style={[
                      styles.nodeDay,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    {node.dayLabel}
                  </Text>
                  <Text
                    style={[
                      styles.nodeTitle,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    {node.title}
                  </Text>
                  <Text
                    style={[
                      styles.nodeText,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    {node.body}
                  </Text>

                  {node.key === 'reminder' && !isPermissionGranted ? (
                    <HapticPressable
                      accessibilityLabel="Turn on notifications"
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() =>
                        handleEnableReminders().catch(() => undefined)
                      }
                      style={({ pressed }) => [pressed && styles.pressed]}
                    >
                      <Text
                        style={[
                          styles.nodeAction,
                          { color: theme.colors.primary },
                        ]}
                      >
                        Turn on notifications
                      </Text>
                    </HapticPressable>
                  ) : null}
                </View>
              </Animated.View>
            ))}
          </View>
        </View>

        <Animated.View
          style={[
            styles.footer,
            {
              opacity: footerAnim,
              transform: [
                {
                  translateY: footerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {finishError ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.errorText, { color: theme.colors.destructive }]}
            >
              {finishError}
            </Text>
          ) : null}

          <HapticPressable
            accessibilityLabel="Continue"
            accessibilityRole="button"
            accessibilityState={{ busy: isFinishing, disabled: isFinishing }}
            disabled={isFinishing}
            onPress={() => handleContinue().catch(() => undefined)}
            style={({ pressed }) => [
              styles.continueButton,
              { backgroundColor: theme.colors.primary },
              (pressed || isFinishing) && styles.pressed,
            ]}
          >
            <ButtonLoadingContent
              loaderColor={theme.colors.primaryForeground}
              loading={isFinishing}
            >
              <Text
                style={[
                  styles.continueButtonText,
                  { color: theme.colors.primaryForeground },
                ]}
              >
                Continue
              </Text>
            </ButtonLoadingContent>
          </HapticPressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  continueButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 56,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginBottom: 12,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: 18,
  },
  node: {
    flexDirection: 'row',
    gap: 16,
  },
  nodeAction: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  nodeBody: {
    flex: 1,
    paddingBottom: 28,
  },
  nodeDay: {
    fontSize: 11,
    fontWeight: '700',
    // Tabular figures so a late trial-length update swaps in place.
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  nodeText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  nodeTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.9,
  },
  rail: {
    alignItems: 'center',
    width: 28,
  },
  railDot: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  railSegment: {
    flex: 1,
    marginVertical: 4,
    width: 2,
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 30,
    paddingHorizontal: 24,
    paddingTop: 64,
  },
  timeline: {
    marginTop: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
});
