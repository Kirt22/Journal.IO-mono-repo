import HapticPressable from '../../components/HapticPressable';
import {
  useCallback,
  useEffect,
  useRef,
  useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../../infrastructure/reactNative';
import { SafeAreaView } from 'react-native-safe-area-context';
import ButtonLoadingContent from '../../components/ButtonLoadingContent';
import OnboardingReminderTimeSheet from '../../components/OnboardingReminderTimeSheet';
import { triggerHaptic } from '../../services/hapticsService';
import {
  cancelReminderNotifications,
  getDefaultReminderTimezone,
  getReminderPermissionGranted,
  requestReminderPermission,
  syncReminderNotifications,
} from '../../services/reminderNotificationsService';
import {
  createReminder,
  getPrimaryDailyReminder,
  updateReminder,
  type Reminder,
} from '../../services/remindersService';
import { useTheme } from '../../theme/provider';

type Props = {
  onComplete: () => Promise<void>;
};

type ReminderDraft = {
  time: string;
};

const DEFAULT_REMINDER_TIME = '20:00';
// Mirrors the iOS bundle display name (CFBundleDisplayName) so the primer card
// reads like the real system notification prompt.
const APP_DISPLAY_NAME = 'Journal.IO';
const reminderBellIcon = require('../../assets/png/onboarding/icons8-notification-bell.png');

const buildDraft = (reminder?: Reminder | null): ReminderDraft => ({
  time: reminder?.time || DEFAULT_REMINDER_TIME,
});

export default function OnboardingRemindersScreen({ onComplete }: Props) {
  const theme = useTheme();
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReminderDraft>(buildDraft());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isTimeSheetVisible, setIsTimeSheetVisible] = useState(false);
  const [isIntroReady, setIsIntroReady] = useState(false);
  const [hasDeclined, setHasDeclined] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  // Each item enters on its own step so the screen reveals one thing at a time:
  // bell (+ shake) -> title -> permission card -> continue button.
  const iconAnim = useRef(new Animated.Value(0)).current;
  const iconShake = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;
  const fingerBounce = useRef(new Animated.Value(0)).current;
  const fingerLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const loadReminder = useCallback(async () => {
    setIsLoading(true);
    setLoadErrorMessage(null);

    try {
      const reminder = await getPrimaryDailyReminder();
      setReminderId(reminder?.reminderId || null);
      setDraft(buildDraft(reminder));
    } catch {
      setLoadErrorMessage('We could not load your reminder settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReminder().catch(() => undefined);
  }, [loadReminder]);

  useEffect(() => {
    let isActive = true;
    let entrance: Animated.CompositeAnimation | null = null;
    let runtimeReduceMotionPreference: boolean | null = null;

    const startFingerLoop = () => {
      fingerLoopRef.current?.stop();
      fingerBounce.setValue(0);
      fingerLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(fingerBounce, {
            toValue: 1,
            duration: 620,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(fingerBounce, {
            toValue: 0,
            duration: 620,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(160),
        ]),
      );
      fingerLoopRef.current.start();
    };

    const settle = () => {
      entrance?.stop();
      fingerLoopRef.current?.stop();
      fingerBounce.setValue(0);
      iconShake.setValue(0);
      iconAnim.setValue(1);
      titleAnim.setValue(1);
      cardAnim.setValue(1);
      footerAnim.setValue(1);
      setIsIntroReady(true);
    };

    const reveal = (value: Animated.Value, duration: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    const play = () => {
      if (!isActive) {
        return;
      }

      setIsIntroReady(false);
      iconAnim.setValue(0);
      iconShake.setValue(0);
      titleAnim.setValue(0);
      cardAnim.setValue(0);
      footerAnim.setValue(0);

      entrance = Animated.sequence([
        Animated.delay(160),
        // 1) bell drops in, then a quick shake
        reveal(iconAnim, 460),
        Animated.sequence([
          Animated.timing(iconShake, {
            toValue: 1,
            duration: 80,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(iconShake, {
            toValue: -1,
            duration: 110,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(iconShake, {
            toValue: 0.65,
            duration: 100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(iconShake, {
            toValue: 0,
            duration: 110,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        // 2) title
        reveal(titleAnim, 420),
        // 3) permission card
        reveal(cardAnim, 480),
        // 4) continue button + hint
        reveal(footerAnim, 420),
      ]);

      entrance.start(({ finished }) => {
        if (finished && isActive) {
          setIsIntroReady(true);
          startFingerLoop();
        }
      });
    };

    const handleReduceMotionChange = (enabled: boolean) => {
      runtimeReduceMotionPreference = enabled;
      if (enabled) {
        settle();
      } else {
        play();
      }
    };

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      handleReduceMotionChange,
    );

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (!isActive) {
          return;
        }

        if (runtimeReduceMotionPreference ?? enabled) {
          settle();
        } else {
          play();
        }
      })
      .catch(play);

    return () => {
      isActive = false;
      subscription.remove();
      entrance?.stop();
      fingerLoopRef.current?.stop();
    };
  }, [cardAnim, fingerBounce, footerAnim, iconAnim, iconShake, titleAnim]);

  // Stop nudging once the user has acted on the primer.
  useEffect(() => {
    if (hasDeclined || isTimeSheetVisible) {
      fingerLoopRef.current?.stop();
      Animated.timing(fingerBounce, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start();
    }
  }, [fingerBounce, hasDeclined, isTimeSheetVisible]);

  const saveReminder = async (enabled: boolean) => {
    const timezone = getDefaultReminderTimezone();

    if (!enabled && !reminderId) {
      await cancelReminderNotifications();
      return;
    }

    const reminder = reminderId
      ? await updateReminder(reminderId, {
          enabled,
          includeWeekends: true,
          skipIfCompletedToday: true,
          time: draft.time,
          timezone,
        })
      : await createReminder({
          enabled: true,
          includeWeekends: true,
          skipIfCompletedToday: true,
          time: draft.time,
          timezone,
        });

    setReminderId(reminder.reminderId);

    if (reminder.enabled) {
      await syncReminderNotifications(reminder);
    } else {
      await cancelReminderNotifications();
    }
  };

  const handleAllowReminders = async () => {
    if (isLoading || isRequestingPermission || isSaving) {
      return;
    }

    setIsRequestingPermission(true);
    setHasDeclined(false);
    setPermissionMessage(null);
    triggerHaptic('primaryAction').catch(() => undefined);

    try {
      const permissionGranted = await requestReminderPermission();
      if (!permissionGranted) {
        setPermissionMessage(
          'Notifications are off. You can continue without a reminder or enable them later in Settings.',
        );
        return;
      }

      setIsTimeSheetVisible(true);
    } catch {
      setPermissionMessage('We could not update notifications right now. Please try again.');
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleDeclineReminders = () => {
    if (isRequestingPermission || isSaving) {
      return;
    }

    triggerHaptic('secondaryAction').catch(() => undefined);
    setPermissionMessage(null);
    setHasDeclined(true);
  };

  const handleSaveReminder = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setPermissionMessage(null);
    triggerHaptic('primaryAction').catch(() => undefined);

    try {
      const permissionGranted = await getReminderPermissionGranted();
      if (!permissionGranted) {
        setIsTimeSheetVisible(false);
        setPermissionMessage(
          'Notifications are off. You can continue without a reminder or enable them later in Settings.',
        );
        return;
      }

      await saveReminder(true);
      await onComplete();
    } catch {
      setPermissionMessage('We could not save your reminder. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinueWithoutReminder = async () => {
    if (isLoading || isSaving || isRequestingPermission) {
      return;
    }

    setIsSaving(true);
    setPermissionMessage(null);
    triggerHaptic('primaryAction').catch(() => undefined);

    try {
      await saveReminder(false);
      await onComplete();
    } catch {
      setPermissionMessage('We could not save this step. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const isBusy = isLoading || isRequestingPermission || isSaving;
  const cardRadius = 22;

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <Animated.Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="Reminder bell"
            resizeMode="contain"
            source={reminderBellIcon}
            style={[
              styles.bellIcon,
              {
                opacity: iconAnim,
                transform: [
                  {
                    scale: iconAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1],
                    }),
                  },
                  {
                    translateY: iconAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 0],
                    }),
                  },
                  {
                    rotate: iconShake.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: ['-16deg', '0deg', '16deg'],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.Text
            style={[
              styles.title,
              {
                color: theme.colors.foreground,
                opacity: titleAnim,
                transform: [
                  {
                    translateY: titleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            Stay on track with gentle reminders
          </Animated.Text>
        </View>

        <View style={styles.centerZone}>
          <Animated.View
            style={[
              styles.dialogWrap,
              {
                opacity: cardAnim,
                transform: [
                  {
                    translateY: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                  {
                    scale: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Custom primer styled like the iOS system notification prompt. */}
            <View
              style={[
                styles.dialogCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  borderRadius: cardRadius,
                },
              ]}
            >
              <View style={styles.dialogBody}>
                <Text style={[styles.dialogTitle, { color: theme.colors.foreground }]}>
                  “{APP_DISPLAY_NAME}” Would Like to Send You Notifications
                </Text>
                <Text
                  style={[styles.dialogText, { color: theme.colors.mutedForeground }]}
                >
                  Notifications may include a gentle daily nudge to check in. You can
                  change or turn these off anytime in Settings.
                </Text>
              </View>
              <View
                style={[styles.dialogDivider, { backgroundColor: theme.colors.border }]}
              />
              <View style={styles.dialogActions}>
                <HapticPressable
                  accessibilityLabel="Don't allow reminders"
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={handleDeclineReminders}
                  style={({ pressed }) => [
                    styles.dialogButton,
                    styles.dialogButtonLeft,
                    {
                      borderRightColor: theme.colors.border,
                      borderBottomLeftRadius: cardRadius,
                    },
                    pressed && styles.pressedSoft,
                  ]}
                >
                  <Text
                    style={[
                      styles.dialogButtonText,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    Don't Allow
                  </Text>
                </HapticPressable>
                <HapticPressable
                  accessibilityLabel="Allow reminders"
                  accessibilityRole="button"
                  accessibilityState={{
                    busy: isRequestingPermission,
                    disabled: !isIntroReady || isBusy,
                  }}
                  disabled={!isIntroReady || isBusy}
                  onPress={() => handleAllowReminders().catch(() => undefined)}
                  style={({ pressed }) => [
                    styles.dialogButton,
                    {
                      backgroundColor: theme.colors.primary,
                      borderBottomRightRadius: cardRadius,
                    },
                    (pressed || isRequestingPermission) && styles.pressed,
                  ]}
                >
                  <ButtonLoadingContent
                    loaderColor={theme.colors.primaryForeground}
                    loading={isRequestingPermission}
                  >
                    <Text
                      style={[
                        styles.dialogButtonText,
                        styles.dialogButtonAllow,
                        { color: theme.colors.primaryForeground },
                      ]}
                    >
                      Allow
                    </Text>
                  </ButtonLoadingContent>
                </HapticPressable>
              </View>
            </View>

            {/* Pointing hand nudging toward Allow. */}
            <View style={styles.fingerRow} pointerEvents="none">
              {hasDeclined ? null : (
                <Animated.Text
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  style={[
                    styles.fingerEmoji,
                    {
                      transform: [
                        {
                          translateY: fingerBounce.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -9],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  👆
                </Animated.Text>
              )}
            </View>
          </Animated.View>

          {permissionMessage ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.permissionMessage, { color: theme.colors.destructive }]}
            >
              {permissionMessage}
            </Text>
          ) : null}
          {loadErrorMessage ? (
            <HapticPressable
              accessibilityLabel="Retry loading reminder settings"
              accessibilityRole="button"
              disabled={isLoading}
              onPress={() => loadReminder().catch(() => undefined)}
            >
              <Text style={[styles.retryText, { color: theme.colors.primary }]}>
                Retry loading settings
              </Text>
            </HapticPressable>
          ) : null}
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
          <HapticPressable
            accessibilityLabel="Continue without a reminder"
            accessibilityRole="button"
            accessibilityState={{
              busy: isSaving,
              disabled: !isIntroReady || isBusy,
            }}
            disabled={!isIntroReady || isBusy}
            onPress={() => handleContinueWithoutReminder().catch(() => undefined)}
            style={({ pressed }) => [
              styles.continueButton,
              {
                backgroundColor: theme.colors.primary,
              },
              (pressed || isSaving) && styles.pressed,
            ]}
          >
            <ButtonLoadingContent
              loaderColor={theme.colors.primaryForeground}
              loading={isSaving}
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
          <HapticPressable
            accessibilityLabel="Skip reminders for now"
            accessibilityRole="button"
            disabled={!isIntroReady || isBusy}
            hitSlop={8}
            onPress={() => handleContinueWithoutReminder().catch(() => undefined)}
            style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
          >
            <Text style={[styles.skipText, { color: theme.colors.mutedForeground }]}>
              Skip for now
            </Text>
          </HapticPressable>
        </Animated.View>
      </View>

      <OnboardingReminderTimeSheet
        isSaving={isSaving}
        onDismiss={() => setIsTimeSheetVisible(false)}
        onSave={() => handleSaveReminder().catch(() => undefined)}
        onSelectTime={time => setDraft(current => ({ ...current, time }))}
        selectedTime={draft.time}
        visible={isTimeSheetVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bellIcon: {
    height: 56,
    marginBottom: 20,
    width: 56,
  },
  centerZone: {
    alignItems: 'center',
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
  dialogActions: {
    flexDirection: 'row',
  },
  dialogBody: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
  },
  dialogButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  dialogButtonAllow: {
    fontWeight: '600',
  },
  dialogButtonLeft: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  dialogButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  dialogCard: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
    width: '100%',
  },
  dialogDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  dialogText: {
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 7,
    textAlign: 'center',
  },
  dialogTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 22,
    textAlign: 'center',
  },
  dialogWrap: {
    alignSelf: 'center',
    maxWidth: 320,
    width: '100%',
  },
  fingerEmoji: {
    fontSize: 34,
    letterSpacing: -0.7,  },
  fingerRow: {
    alignItems: 'flex-end',
    paddingRight: 34,
    paddingTop: 8,
  },
  footer: {
    gap: 16,
    paddingBottom: 18,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  header: {
    alignItems: 'center',
  },
  permissionMessage: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 22,
    maxWidth: 320,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
  pressedSoft: {
    opacity: 0.6,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 30,
    textAlign: 'center',
  },
});
