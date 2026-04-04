import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import {
  Bell,
  Check,
  ChevronDown,
  Clock3,
  Smartphone,
} from "lucide-react-native";
import PrimaryButton from "../../components/PrimaryButton";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../theme/provider";
import {
  createReminder,
  getPrimaryDailyReminder,
  updateReminder,
  type Reminder,
} from "../../services/remindersService";
import {
  cancelReminderNotifications,
  getDefaultReminderTimezone,
  requestReminderPermission,
  sendTestReminderNotification,
  syncReminderNotifications,
} from "../../services/reminderNotificationsService";
import { getCurrentStreakSummary } from "../../services/streaksService";
import { ProfileSectionLayout, SectionCard } from "../profile/ProfileSectionLayout";

type RemindersScreenProps = {
  onBack: () => void;
};

type ReminderFormState = {
  enabled: boolean;
  time: string;
  timezone: string;
  skipIfCompletedToday: boolean;
  includeWeekends: boolean;
  streakWarnings: boolean;
};

const TIME_OPTIONS = [
  { label: "8:00 AM", value: "08:00" },
  { label: "9:00 AM", value: "09:00" },
  { label: "12:00 PM", value: "12:00" },
  { label: "6:00 PM", value: "18:00" },
  { label: "8:00 PM", value: "20:00" },
  { label: "9:00 PM", value: "21:00" },
];

const onboardingReminderToTime: Record<string, string> = {
  morning: "08:00",
  afternoon: "14:00",
  evening: "20:00",
};

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");

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
        <Text style={[styles.smartToggleLabel, { color: theme.colors.foreground }]}>
          {label}
        </Text>
        <Text
          style={[styles.smartToggleDescription, { color: theme.colors.mutedForeground }]}
        >
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor={theme.colors.card}
      />
    </View>
  );
}

const buildDefaultReminderState = (onboardingPreference?: string | null): ReminderFormState => ({
  enabled: false,
  time: onboardingReminderToTime[onboardingPreference || ""] || "20:00",
  timezone: getDefaultReminderTimezone(),
  skipIfCompletedToday: true,
  includeWeekends: true,
  streakWarnings: true,
});

const toReminderFormState = (reminder: Reminder): ReminderFormState => ({
  enabled: reminder.enabled,
  time: reminder.time,
  timezone: reminder.timezone || getDefaultReminderTimezone(),
  skipIfCompletedToday: reminder.skipIfCompletedToday,
  includeWeekends: reminder.includeWeekends,
  streakWarnings: reminder.streakWarnings,
});

const getReminderPreviewTime = (time: string) =>
  TIME_OPTIONS.find(option => option.value === time)?.label || "8:00 PM";

export default function RemindersScreen({ onBack }: RemindersScreenProps) {
  const theme = useTheme();
  const onboardingReminderPreference = useAppStore(
    state => state.onboardingData?.reminderPreference
  );
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ReminderFormState>(
    buildDefaultReminderState(onboardingReminderPreference)
  );
  const [savedState, setSavedState] = useState<ReminderFormState>(
    buildDefaultReminderState(onboardingReminderPreference)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isTimeMenuOpen, setIsTimeMenuOpen] = useState(false);
  const [isTimeMenuRendered, setIsTimeMenuRendered] = useState(false);
  const [hasAnimatedIn, setHasAnimatedIn] = useState(false);
  const timeMenuAnimation = useRef(new Animated.Value(0)).current;
  const entranceAnimation = useRef(new Animated.Value(0)).current;

  const isDirty = useMemo(
    () => JSON.stringify(formState) !== JSON.stringify(savedState),
    [formState, savedState]
  );

  const loadReminder = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const reminder = await getPrimaryDailyReminder();

      if (!reminder) {
        const fallbackState = buildDefaultReminderState(onboardingReminderPreference);
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
        error instanceof Error ? error.message : "Unable to load reminders right now."
      );
    } finally {
      setIsLoading(false);
    }
  }, [onboardingReminderPreference]);

  useEffect(() => {
    loadReminder().catch(error => {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load reminders right now."
      );
      setIsLoading(false);
    });
  }, [loadReminder]);

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

  const persistReminder = async (nextState: ReminderFormState) => {
    const payload = {
      enabled: nextState.enabled,
      time: nextState.time,
      timezone: nextState.timezone,
      skipIfCompletedToday: nextState.skipIfCompletedToday,
      includeWeekends: nextState.includeWeekends,
      streakWarnings: nextState.streakWarnings,
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

    const currentStreak = reminder.streakWarnings
      ? (await getCurrentStreakSummary()).currentStreak
      : 0;

    await syncReminderNotifications(reminder, { currentStreak });
  };

  const handleToggleEnabled = async (nextValue: boolean) => {
    setStatusMessage(null);
    const nextState = {
      ...formState,
      enabled: nextValue,
      timezone: getDefaultReminderTimezone(),
    };
    const previousState = formState;
    setFormState(nextState);
    setIsSaving(true);

    try {
      if (nextValue) {
        const permissionGranted = await requestReminderPermission();

        if (!permissionGranted) {
          setFormState(previousState);
          Alert.alert(
            "Notifications disabled",
            "Allow notifications in system settings to enable daily reminders."
          );
          return;
        }
      }

      const savedReminder = await persistReminder(nextState);
      setReminderId(savedReminder.reminderId);
      const normalized = toReminderFormState(savedReminder);
      setFormState(normalized);
      setSavedState(normalized);
      await syncLocalNotifications(savedReminder);
      setStatusMessage(nextValue ? "Daily reminders enabled." : "Reminders disabled.");
    } catch (error) {
      setFormState(previousState);
      Alert.alert(
        "Reminder settings",
        error instanceof Error ? error.message : "Unable to update reminders right now."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveChanges = async () => {
    setStatusMessage(null);
    setIsSaving(true);

    try {
      if (formState.enabled) {
        const permissionGranted = await requestReminderPermission();

        if (!permissionGranted) {
          Alert.alert(
            "Notifications disabled",
            "Allow notifications in system settings to save an active reminder."
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
      setFormState(normalized);
      setSavedState(normalized);
      await syncLocalNotifications(savedReminder);
      setStatusMessage("Reminder settings saved.");
    } catch (error) {
      Alert.alert(
        "Reminder settings",
        error instanceof Error ? error.message : "Unable to save your reminder right now."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestNotification = async () => {
    setStatusMessage(null);

    try {
      const permissionGranted = await requestReminderPermission();

      if (!permissionGranted) {
        Alert.alert(
          "Notifications disabled",
          "Allow notifications in system settings to send a test reminder."
        );
        return;
      }

      await sendTestReminderNotification(getReminderPreviewTime(formState.time));
      setStatusMessage("Test notification sent.");
    } catch (error) {
      Alert.alert(
        "Test notification",
        error instanceof Error ? error.message : "Unable to send a test notification right now."
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
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.mutedForeground }]}>
              Loading your reminder settings...
            </Text>
          </View>
        </SectionCard>
      ) : errorMessage ? (
        <SectionCard borderColor={hexToRgba(theme.colors.destructive, 0.4)}>
          <Text style={[styles.errorTitle, { color: theme.colors.foreground }]}>
            Unable to load reminders
          </Text>
          <Text style={[styles.errorBody, { color: theme.colors.mutedForeground }]}>
            {errorMessage}
          </Text>
          <PrimaryButton label="Try Again" onPress={loadReminder} variant="outline" />
        </SectionCard>
      ) : (
        <>
          <Animated.View style={buildEntranceStyle(14)}>
            <SectionCard>
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
                  <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
                    Daily Reminders
                  </Text>
                  <Text
                    style={[styles.cardDescription, { color: theme.colors.mutedForeground }]}
                  >
                    Get notified to maintain your streak
                  </Text>
                </View>
              </View>

              <View style={styles.reminderToggleRow}>
                <View style={styles.reminderToggleCopy}>
                  <Text style={[styles.toggleLabel, { color: theme.colors.foreground }]}>
                    Enable reminders
                  </Text>
                  <Text
                    style={[styles.toggleDescription, { color: theme.colors.mutedForeground }]}
                  >
                    Daily prompts at your chosen time
                  </Text>
                </View>
                <Switch
                  value={formState.enabled}
                  onValueChange={handleToggleEnabled}
                  disabled={isSaving}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
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
                  <Text style={[styles.selectLabel, { color: theme.colors.foreground }]}>
                    Reminder Time
                  </Text>

                  <View style={styles.selectWrapper}>
                    <Pressable
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
                        <Clock3 size={15} color={theme.colors.mutedForeground} />
                        <Text
                          style={[styles.selectTriggerText, { color: theme.colors.foreground }]}
                        >
                          {getReminderPreviewTime(formState.time)}
                        </Text>
                      </View>
                      <ChevronDown
                        size={16}
                        color={theme.colors.mutedForeground}
                        style={[styles.chevron, isTimeMenuOpen ? styles.chevronOpen : null]}
                      />
                    </Pressable>

                    {isTimeMenuRendered ? (
                      <Animated.View
                        pointerEvents={isTimeMenuOpen ? "auto" : "none"}
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
                            <Pressable
                              key={option.value}
                              accessibilityRole="button"
                              onPress={() => {
                                setFormState(current => ({
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
                                    : "transparent",
                                  borderColor: isSelected
                                    ? theme.colors.primary
                                    : "transparent",
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
                            </Pressable>
                          );
                        })}
                      </Animated.View>
                    ) : null}
                  </View>

                  {isDirty ? (
                    <PrimaryButton
                      label="Save Changes"
                      onPress={handleSaveChanges}
                      loading={isSaving}
                      tone="accent"
                    />
                  ) : null}
                </View>
              ) : null}
            </SectionCard>
          </Animated.View>

          <Animated.View style={buildEntranceStyle(18)}>
            <SectionCard>
              <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
                Notification Style
              </Text>
              <Text style={[styles.cardDescription, { color: theme.colors.mutedForeground }]}>
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
                  <Text style={[styles.previewTitle, { color: theme.colors.foreground }]}>
                    {getReminderPreviewTime(formState.time)} reminder
                  </Text>
                  <Text
                    style={[styles.previewBody, { color: theme.colors.mutedForeground }]}
                  >
                    Take a moment to reflect on your day. Keep your streak going!
                  </Text>
                </View>
              </View>

              <View style={styles.previewAction}>
                <PrimaryButton
                  label="Send Test Notification"
                  onPress={handleSendTestNotification}
                  variant="outline"
                  size="sm"
                />
              </View>
            </SectionCard>
          </Animated.View>

          <Animated.View style={buildEntranceStyle(22)}>
            <SectionCard>
              <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
                Smart Reminders
              </Text>
              <Text style={[styles.cardDescription, { color: theme.colors.mutedForeground }]}>
                Personalized notification preferences
              </Text>

              <View style={styles.smartToggleStack}>
                <SmartToggleRow
                  label="Skip on days with entries"
                  description="Don't remind if you've already journaled today"
                  value={formState.skipIfCompletedToday}
                  onValueChange={nextValue =>
                    setFormState(current => ({ ...current, skipIfCompletedToday: nextValue }))
                  }
                />
                <SmartToggleRow
                  label="Weekend reminders"
                  description="Include Saturday and Sunday"
                  value={formState.includeWeekends}
                  onValueChange={nextValue =>
                    setFormState(current => ({ ...current, includeWeekends: nextValue }))
                  }
                />
                <SmartToggleRow
                  label="Streak warnings"
                  description="Extra reminder if you're about to lose your streak"
                  value={formState.streakWarnings}
                  onValueChange={nextValue =>
                    setFormState(current => ({ ...current, streakWarnings: nextValue }))
                  }
                />
              </View>
            </SectionCard>
          </Animated.View>

          <Animated.View style={buildEntranceStyle(26)}>
            <View
              style={[
                styles.infoCard,
                { backgroundColor: theme.colors.accent },
              ]}
            >
              <Smartphone size={20} color={theme.colors.primary} />
              <View style={styles.infoCopy}>
                <Text style={[styles.infoTitle, { color: theme.colors.foreground }]}>
                  Enable notifications on your device
                </Text>
                <Text style={[styles.infoBody, { color: theme.colors.mutedForeground }]}>
                  Journal.IO uses local reminders for scheduled writing prompts. You can change
                  permissions later in system settings.
                </Text>
              </View>
            </View>
          </Animated.View>

          {statusMessage ? (
            <Text style={[styles.statusMessage, { color: theme.colors.primary }]}>
              {statusMessage}
            </Text>
          ) : null}
        </>
      )}
    </ProfileSectionLayout>
  );
}

const styles = StyleSheet.create({
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  errorBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderCopy: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  cardDescription: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  reminderToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reminderToggleCopy: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600",
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
  },
  selectLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  selectWrapper: {
    position: "relative",
    zIndex: 2,
  },
  selectTrigger: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectTriggerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectTriggerText: {
    fontSize: 15,
    fontWeight: "600",
  },
  chevron: {
    transform: [{ rotate: "0deg" }],
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  selectMenu: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    shadowColor: "#000000",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  previewCard: {
    marginTop: 16,
    borderLeftWidth: 4,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  previewIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCopy: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  previewBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  previewAction: {
    marginTop: 14,
  },
  smartToggleStack: {
    marginTop: 14,
    gap: 14,
  },
  smartToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  smartToggleCopy: {
    flex: 1,
  },
  smartToggleLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  smartToggleDescription: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
  },
  infoCard: {
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoCopy: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  statusMessage: {
    fontSize: 13,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.82,
  },
});
