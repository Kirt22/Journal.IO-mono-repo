import HapticPressable from '../../components/HapticPressable';
import HapticSwitch from '../../components/HapticSwitch';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import {
  Alert,
  AppState,
  Animated,
  Easing,
  LayoutAnimation,
  Linking,
  Platform,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import {
  Text,
} from '../../infrastructure/reactNative';
import { Bell, Check, ChevronDown, Clock3 } from 'lucide-react-native';
import PrimaryButton from '../../components/PrimaryButton';
import JournalLoader from '../../components/JournalLoader';
import { triggerHaptic } from '../../services/hapticsService';
import { useAppStore } from '../../store/appStore';
import { REMINDER_TIME_OPTIONS } from '../../constants/reminderTimes';
import { useTheme } from '../../theme/provider';
import {
  createReminder,
  getPrimaryDailyReminder,
  updateReminder,
  type Reminder,
} from '../../services/remindersService';
import {
  cancelReminderNotifications,
  getDefaultReminderTimezone,
  getReminderPermissionGranted,
  requestReminderPermission,
  syncReminderNotifications,
} from '../../services/reminderNotificationsService';
import {
  ProfileSectionLayout,
  SectionCard,
} from '../profile/ProfileSectionLayout';

type RemindersScreenProps = {
  onBack: () => void;
};

type ReminderFormState = {
  enabled: boolean;
  time: string;
  timezone: string;
  skipIfCompletedToday: boolean;
  includeWeekends: boolean;
};

const TIME_OPTIONS = REMINDER_TIME_OPTIONS;

const onboardingReminderToTime: Record<string, string> = {
  morning: '08:00',
  afternoon: '14:00',
  evening: '20:00',
};

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function SmartToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (nextValue: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.smartToggleRow}>
      <View style={styles.smartToggleCopy}>
        <Text
          style={[styles.smartToggleLabel, { color: theme.colors.foreground }]}
        >
          {label}
        </Text>
        <Text
          style={[
            styles.smartToggleDescription,
            { color: theme.colors.mutedForeground },
          ]}
        >
          {description}
        </Text>
      </View>
      <HapticSwitch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor={theme.colors.card}
      />
    </View>
  );
}

const buildDefaultReminderState = (
  onboardingPreference?: string | null,
): ReminderFormState => ({
  enabled: false,
  time: onboardingReminderToTime[onboardingPreference || ''] || '20:00',
  timezone: getDefaultReminderTimezone(),
  skipIfCompletedToday: true,
  includeWeekends: true,
});

const toReminderFormState = (reminder: Reminder): ReminderFormState => ({
  enabled: reminder.enabled,
  time: reminder.time,
  timezone: reminder.timezone || getDefaultReminderTimezone(),
  skipIfCompletedToday: reminder.skipIfCompletedToday,
  includeWeekends: reminder.includeWeekends,
});

const getReminderPreviewTime = (time: string) =>
  TIME_OPTIONS.find(option => option.value === time)?.label || '8:00 PM';

const REMINDER_LAYOUT_ANIMATION = {
  duration: 230,
  create: {
    type: LayoutAnimation.Types.easeOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

export default function RemindersScreen({ onBack }: RemindersScreenProps) {
  const theme = useTheme();
  const onboardingReminderPreference = useAppStore(
    state => state.onboardingData?.reminderPreference,
  );
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ReminderFormState>(
    buildDefaultReminderState(onboardingReminderPreference),
  );
  const [savedState, setSavedState] = useState<ReminderFormState>(
    buildDefaultReminderState(onboardingReminderPreference),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasNotificationPermission, setHasNotificationPermission] = useState<
    boolean | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTimeMenuOpen, setIsTimeMenuOpen] = useState(false);
  const [isTimeMenuRendered, setIsTimeMenuRendered] = useState(false);
  const [hasAnimatedIn, setHasAnimatedIn] = useState(false);
  const timeMenuAnimation = useRef(new Animated.Value(0)).current;
  const entranceAnimation = useRef(new Animated.Value(0)).current;
  const saveReveal = useRef(new Animated.Value(0)).current;
  const wasDirty = useRef(false);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(formState) !== JSON.stringify(savedState),
    [formState, savedState],
  );
  const isSaveActionVisible = hasUnsavedChanges && !isSaving;

  const refreshNotificationPermission = useCallback(async () => {
    try {
      setHasNotificationPermission(await getReminderPermissionGranted());
    } catch {
      setHasNotificationPermission(false);
    }
  }, []);

  const animateReminderLayout = () => {
    LayoutAnimation.configureNext(REMINDER_LAYOUT_ANIMATION);
  };

  const updateFormState = (
    update: (currentState: ReminderFormState) => ReminderFormState,
  ) => {
    animateReminderLayout();
    setFormState(update);
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  const loadReminder = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [reminder, permissionGranted] = await Promise.all([
        getPrimaryDailyReminder(),
        getReminderPermissionGranted(),
      ]);
      setHasNotificationPermission(permissionGranted);

      if (!reminder) {
        const fallbackState = buildDefaultReminderState(
          onboardingReminderPreference,
        );
        setReminderId(null);
        setFormState(fallbackState);
        setSavedState(fallbackState);
        return;
      }

      const nextState = toReminderFormState(reminder);
      setReminderId(reminder.reminderId);
      setFormState(nextState);
      setSavedState(nextState);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load reminders right now.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [onboardingReminderPreference]);

  useEffect(() => {
    loadReminder().catch(error => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load reminders right now.',
      );
      setIsLoading(false);
    });
  }, [loadReminder]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        refreshNotificationPermission().catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [refreshNotificationPermission]);

  useEffect(() => {
    if (hasAnimatedIn) {
      return;
    }

    setHasAnimatedIn(true);
    Animated.timing(entranceAnimation, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entranceAnimation, hasAnimatedIn]);

  useEffect(() => {
    if (isTimeMenuOpen) {
      setIsTimeMenuRendered(true);
      Animated.timing(timeMenuAnimation, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(timeMenuAnimation, {
      toValue: 0,
      duration: 150,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsTimeMenuRendered(false);
      }
    });
  }, [isTimeMenuOpen, timeMenuAnimation]);

  useEffect(() => {
    if (!isSaveActionVisible) {
      wasDirty.current = false;
      saveReveal.setValue(0);
      return;
    }

    if (wasDirty.current) {
      return;
    }

    wasDirty.current = true;
    saveReveal.setValue(0);
    triggerHaptic('optionSelected').catch(() => undefined);

    const animation = Animated.spring(saveReveal, {
      toValue: 1,
      damping: 16,
      stiffness: 220,
      mass: 0.85,
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [isSaveActionVisible, saveReveal]);

  const persistReminder = async (nextState: ReminderFormState) => {
    const payload = {
      enabled: nextState.enabled,
      time: nextState.time,
      timezone: nextState.timezone,
      skipIfCompletedToday: nextState.skipIfCompletedToday,
      includeWeekends: nextState.includeWeekends,
    };

    if (!reminderId) {
      return createReminder(payload);
    }

    return updateReminder(reminderId, payload);
  };

  const syncLocalNotifications = async (reminder: Reminder) => {
    if (!reminder.enabled) {
      await cancelReminderNotifications();
      return;
    }

    await syncReminderNotifications(reminder);
  };

  const handleToggleEnabled = async (nextValue: boolean) => {
    const nextState = {
      ...formState,
      enabled: nextValue,
      timezone: getDefaultReminderTimezone(),
    };
    const previousState = formState;
    animateReminderLayout();
    setIsSaving(true);

    try {
      if (nextValue) {
        const permissionGranted = await requestReminderPermission();
        setHasNotificationPermission(permissionGranted);

        if (!permissionGranted) {
          setFormState(previousState);
          Alert.alert(
            'Notifications disabled',
            'Allow notifications in system settings to enable daily reminders.',
          );
          return;
        }
      }

      animateReminderLayout();
      setFormState(nextState);
      const savedReminder = await persistReminder(nextState);
      setReminderId(savedReminder.reminderId);
      const normalized = toReminderFormState(savedReminder);
      animateReminderLayout();
      setFormState(normalized);
      setSavedState(normalized);
      await syncLocalNotifications(savedReminder);
    } catch (error) {
      animateReminderLayout();
      setFormState(previousState);
      Alert.alert(
        'Reminder settings',
        error instanceof Error
          ? error.message
          : 'Unable to update reminders right now.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveChanges = async () => {
    animateReminderLayout();
    setIsSaving(true);

    try {
      if (formState.enabled) {
        const permissionGranted = await requestReminderPermission();
        setHasNotificationPermission(permissionGranted);

        if (!permissionGranted) {
          Alert.alert(
            'Notifications disabled',
            'Allow notifications in system settings to save an active reminder.',
          );
          setIsSaving(false);
          return;
        }
      }

      const savedReminder = await persistReminder({
        ...formState,
        timezone: getDefaultReminderTimezone(),
      });
      setReminderId(savedReminder.reminderId);
      const normalized = toReminderFormState(savedReminder);
      animateReminderLayout();
      setFormState(normalized);
      setSavedState(normalized);
      await syncLocalNotifications(savedReminder);
    } catch (error) {
      Alert.alert(
        'Reminder settings',
        error instanceof Error
          ? error.message
          : 'Unable to save your reminder right now.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenNotificationSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        'Open device settings',
        'Open your device settings and allow notifications for Journal.IO.',
      );
    }
  };

  const buildEntranceStyle = (offset: number) => ({
    opacity: entranceAnimation,
    transform: [
      {
        translateY: entranceAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [offset, 0],
        }),
      },
    ],
  });

  return (
    <ProfileSectionLayout
      title="Reminders"
      onBack={onBack}
      backgroundTintColor={hexToRgba(theme.colors.primary, 0.018)}
    >
      {isLoading ? (
        <SectionCard>
          <View style={styles.loadingState}>
            <JournalLoader color={theme.colors.primary} />
            <Text
              style={[
                styles.loadingText,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Loading your reminder settings...
            </Text>
          </View>
        </SectionCard>
      ) : errorMessage ? (
        <SectionCard borderColor={hexToRgba(theme.colors.destructive, 0.4)}>
          <Text style={[styles.errorTitle, { color: theme.colors.foreground }]}>
            Unable to load reminders
          </Text>
          <Text
            style={[styles.errorBody, { color: theme.colors.mutedForeground }]}
          >
            {errorMessage}
          </Text>
          <PrimaryButton
            label="Try Again"
            onPress={loadReminder}
            variant="outline"
          />
        </SectionCard>
      ) : (
        <>
          {hasNotificationPermission === false ? (
            <Animated.View style={[buildEntranceStyle(10), styles.baseSection]}>
              <HapticPressable
                accessibilityRole="button"
                accessibilityLabel="Open device notification settings"
                onPress={handleOpenNotificationSettings}
                style={({ pressed }) => [
                  styles.permissionCard,
                  {
                    backgroundColor: theme.colors.accent,
                    borderColor: theme.colors.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.permissionIcon,
                    { backgroundColor: `${theme.colors.primary}1A` },
                  ]}
                >
                  <Bell size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.permissionCopy}>
                  <Text
                    style={[
                      styles.permissionTitle,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    Notifications are disabled
                  </Text>
                  <Text
                    style={[
                      styles.permissionBody,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    Allow notifications in device settings before enabling
                    reminders.
                  </Text>
                  <Text
                    style={[
                      styles.permissionAction,
                      { color: theme.colors.primary },
                    ]}
                  >
                    Open device settings
                  </Text>
                </View>
              </HapticPressable>
            </Animated.View>
          ) : null}

          <Animated.View
            style={[
              buildEntranceStyle(14),
              isTimeMenuRendered ? styles.dropdownSection : styles.baseSection,
            ]}
          >
            <SectionCard
              style={isTimeMenuRendered ? styles.dropdownCard : undefined}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.iconBubble,
                    { backgroundColor: hexToRgba(theme.colors.primary, 0.12) },
                  ]}
                >
                  <Bell size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.cardHeaderCopy}>
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    Daily Reminders
                  </Text>
                  <Text
                    style={[
                      styles.cardDescription,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    Get notified to maintain your streak
                  </Text>
                </View>
              </View>

              <View style={styles.reminderToggleRow}>
                <View style={styles.reminderToggleCopy}>
                  <Text
                    style={[
                      styles.toggleLabel,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    Enable reminders
                  </Text>
                  <Text
                    style={[
                      styles.toggleDescription,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    Daily prompts at your chosen time
                  </Text>
                </View>
                <HapticSwitch
                  value={formState.enabled}
                  onValueChange={handleToggleEnabled}
                  disabled={isSaving}
                  trackColor={{
                    false: theme.colors.border,
                    true: theme.colors.primary,
                  }}
                  thumbColor={theme.colors.card}
                />
              </View>

              {formState.enabled ? (
                <View
                  style={[
                    styles.reminderConfig,
                    { borderTopColor: theme.colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.selectLabel,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    Reminder Time
                  </Text>

                  <View style={styles.selectWrapper}>
                    <HapticPressable
                      accessibilityRole="button"
                      onPress={() => setIsTimeMenuOpen(previous => !previous)}
                      style={({ pressed }) => [
                        styles.selectTrigger,
                        {
                          backgroundColor: theme.colors.accent,
                          borderColor: theme.colors.border,
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.selectTriggerContent}>
                        <Clock3
                          size={15}
                          color={theme.colors.mutedForeground}
                        />
                        <Text
                          style={[
                            styles.selectTriggerText,
                            { color: theme.colors.foreground },
                          ]}
                        >
                          {getReminderPreviewTime(formState.time)}
                        </Text>
                      </View>
                      <ChevronDown
                        size={16}
                        color={theme.colors.mutedForeground}
                        style={[
                          styles.chevron,
                          isTimeMenuOpen ? styles.chevronOpen : null,
                        ]}
                      />
                    </HapticPressable>

                    {isTimeMenuRendered ? (
                      <Animated.View
                        pointerEvents={isTimeMenuOpen ? 'auto' : 'none'}
                        style={[
                          styles.selectMenu,
                          {
                            backgroundColor: theme.colors.card,
                            borderColor: theme.colors.border,
                            opacity: timeMenuAnimation,
                            transform: [
                              {
                                translateY: timeMenuAnimation.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [-6, 0],
                                }),
                              },
                              {
                                scale: timeMenuAnimation.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.98, 1],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        {TIME_OPTIONS.map(option => {
                          const isSelected = option.value === formState.time;

                          return (
                            <HapticPressable
                              key={option.value}
                              accessibilityRole="button"
                              onPress={() => {
                                updateFormState(current => ({
                                  ...current,
                                  time: option.value,
                                  timezone: getDefaultReminderTimezone(),
                                }));
                                setIsTimeMenuOpen(false);
                              }}
                              style={({ pressed }) => [
                                styles.selectOption,
                                {
                                  backgroundColor: isSelected
                                    ? hexToRgba(theme.colors.primary, 0.08)
                                    : 'transparent',
                                  borderColor: isSelected
                                    ? theme.colors.primary
                                    : 'transparent',
                                },
                                pressed && styles.pressed,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.selectOptionText,
                                  {
                                    color: isSelected
                                      ? theme.colors.primary
                                      : theme.colors.foreground,
                                  },
                                ]}
                              >
                                {option.label}
                              </Text>
                              {isSelected ? (
                                <Check size={16} color={theme.colors.primary} />
                              ) : null}
                            </HapticPressable>
                          );
                        })}
                      </Animated.View>
                    ) : null}
                  </View>

                  {isSaveActionVisible ? (
                    <Animated.View
                      style={{
                        opacity: saveReveal,
                        transform: [
                          {
                            translateY: saveReveal.interpolate({
                              inputRange: [0, 1],
                              outputRange: [10, 0],
                            }),
                          },
                          {
                            scale: saveReveal.interpolate({
                              inputRange: [0, 0.72, 1],
                              outputRange: [0.94, 1.035, 1],
                            }),
                          },
                        ],
                      }}
                    >
                      <PrimaryButton
                        label="Save Changes"
                        onPress={handleSaveChanges}
                        loading={isSaving}
                        tone="accent"
                      />
                    </Animated.View>
                  ) : null}
                </View>
              ) : null}
            </SectionCard>
          </Animated.View>

          <Animated.View style={[buildEntranceStyle(18), styles.baseSection]}>
            <SectionCard>
              <Text
                style={[styles.cardTitle, { color: theme.colors.foreground }]}
              >
                Notification Style
              </Text>
              <Text
                style={[
                  styles.cardDescription,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                How reminders will appear
              </Text>

              <View
                style={[
                  styles.previewCard,
                  {
                    backgroundColor: theme.colors.accent,
                    borderLeftColor: theme.colors.primary,
                  },
                ]}
              >
                <View
                  style={[
                    styles.previewIconWrap,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Bell size={16} color={theme.colors.primaryForeground} />
                </View>
                <View style={styles.previewCopy}>
                  <Text
                    style={[
                      styles.previewTitle,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    {getReminderPreviewTime(formState.time)} reminder
                  </Text>
                  <Text
                    style={[
                      styles.previewBody,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    Take a moment to reflect on your day. Keep your streak
                    going!
                  </Text>
                </View>
              </View>
            </SectionCard>
          </Animated.View>

          <Animated.View style={[buildEntranceStyle(22), styles.baseSection]}>
            <SectionCard>
              <Text
                style={[styles.cardTitle, { color: theme.colors.foreground }]}
              >
                Reminder Rules
              </Text>
              <Text
                style={[
                  styles.cardDescription,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                Smart scheduling options
              </Text>

              <View style={styles.smartToggleStack}>
                <SmartToggleRow
                  label="Skip on days with entries"
                  description="Don't remind if you've already journaled today"
                  value={formState.skipIfCompletedToday}
                  onValueChange={nextValue =>
                    updateFormState(current => ({
                      ...current,
                      skipIfCompletedToday: nextValue,
                    }))
                  }
                />
                <SmartToggleRow
                  label="Weekend reminders"
                  description="Include Saturday and Sunday"
                  value={formState.includeWeekends}
                  onValueChange={nextValue =>
                    updateFormState(current => ({
                      ...current,
                      includeWeekends: nextValue,
                    }))
                  }
                />
              </View>
            </SectionCard>
          </Animated.View>
        </>
      )}
    </ProfileSectionLayout>
  );
}

const styles = StyleSheet.create({
  permissionCard: {
    alignItems: 'flex-start',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  permissionIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  permissionCopy: {
    flex: 1,
    gap: 4,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  permissionBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  permissionAction: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  errorBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderCopy: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardDescription: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  reminderToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reminderToggleCopy: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleDescription: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 19,
  },
  reminderConfig: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    gap: 14,
    overflow: 'visible',
  },
  selectLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectWrapper: {
    position: 'relative',
    zIndex: 2,
    elevation: 2,
  },
  selectTrigger: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectTriggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectTriggerText: {
    fontSize: 15,
    fontWeight: '600',
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  selectMenu: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    zIndex: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 6,
  },
  selectOption: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewCard: {
    marginTop: 16,
    borderLeftWidth: 4,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  previewIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCopy: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  smartToggleStack: {
    marginTop: 14,
    gap: 14,
  },
  smartToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  smartToggleCopy: {
    flex: 1,
  },
  smartToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  smartToggleDescription: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.82,
  },
  baseSection: {
    zIndex: 1,
    elevation: 1,
  },
  dropdownSection: {
    zIndex: 30,
    elevation: 30,
  },
  dropdownCard: {
    zIndex: 20,
    elevation: 20,
  },
});
