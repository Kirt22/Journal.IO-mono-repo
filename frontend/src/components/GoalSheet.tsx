import HapticPressable from './HapticPressable';
import HapticSwitch from './HapticSwitch';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
  TextInput,
} from '../infrastructure/reactNative';
import {
  Archive,
  ArchiveRestore,
  Bell,
  Check,
  ChevronDown,
  Target,
  Trash2,
  X,
} from 'lucide-react-native';
import EmojiWithFallback from './EmojiWithFallback';
import ButtonLoadingContent from './ButtonLoadingContent';
import { triggerHaptic } from '../services/hapticsService';
import {
  getReminderPermissionGranted,
  requestReminderPermission,
} from '../services/reminderNotificationsService';
import { useTheme } from '../theme/provider';
import {
  DEFAULT_GOAL_ICON,
  GOAL_ICON_EMOJI,
  GOAL_ICON_PICKER_ORDER,
  resolveUniqueGoalIcon,
  type GoalIconKey,
} from '../constants/goalIcons';
import {
  DEFAULT_REMINDER_TIME,
  REMINDER_TIME_OPTIONS,
  formatReminderTime,
} from '../constants/reminderTimes';
import {
  GOAL_FREQUENCIES,
  GOAL_FREQUENCY_LABELS,
  type GoalFrequency,
} from '../utils/goalPeriod';
import type {
  GoalDraft,
  GoalIconSource,
  SavedGoal,
} from '../services/goalsService';

const GOAL_TITLE_MAX = 120;
const GOAL_DESCRIPTION_MAX = 200;
const EMPTY_GOAL_ICONS: readonly GoalIconKey[] = [];

export type GoalSheetMode = 'add' | 'edit';

type GoalSheetProps = {
  visible: boolean;
  mode: GoalSheetMode;
  /** Present in edit mode; drives archive and unarchive actions. */
  goal?: SavedGoal | null;
  isSubmitting: boolean;
  isDeleting?: boolean;
  errorMessage?: string | null;
  unavailableIcons?: readonly GoalIconKey[];
  onSubmit: (draft: GoalDraft) => void;
  onArchive?: (goal: SavedGoal) => void;
  onUnarchive?: (goal: SavedGoal) => void;
  onDelete?: (goal: SavedGoal) => void;
  onClose: () => void;
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

export default function GoalSheet({
  visible,
  mode,
  goal = null,
  isSubmitting,
  isDeleting = false,
  errorMessage,
  unavailableIcons = EMPTY_GOAL_ICONS,
  onSubmit,
  onArchive,
  onUnarchive,
  onDelete,
  onClose,
}: GoalSheetProps) {
  const theme = useTheme();
  const slide = useRef(new Animated.Value(0)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const actionsReveal = useRef(new Animated.Value(0)).current;
  const iconSelectionPulse = useRef(new Animated.Value(1)).current;
  const frequencySelectionPulse = useRef(new Animated.Value(1)).current;
  const reminderCardReveal = useRef(new Animated.Value(1)).current;
  const reminderDetailsReveal = useRef(new Animated.Value(0)).current;
  const timeMenuReveal = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const dragStartRef = useRef(0);
  const wasVisibleRef = useRef(false);
  const isClosingRef = useRef(false);

  const [isMounted, setIsMounted] = useState(visible);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<GoalIconKey>(DEFAULT_GOAL_ICON);
  const [iconSource, setIconSource] = useState<GoalIconSource>('automatic');
  const [frequency, setFrequency] = useState<GoalFrequency>('daily');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [isTimeMenuOpen, setIsTimeMenuOpen] = useState(false);
  const [isPermissionBlocked, setIsPermissionBlocked] = useState(false);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);

  const isArchived = goal?.status === 'archived';
  const hasLifecycleActions = Boolean(onArchive || onUnarchive || onDelete);
  const isBusy = isSubmitting || isDeleting;
  const isBusyRef = useRef(isBusy);
  isBusyRef.current = isBusy;
  // `as_needed` has no cadence, so a reminder for it is meaningless.
  const supportsReminder = frequency !== 'as_needed';

  const animateSheet = (toVisible: boolean, onFinished?: () => void) => {
    if (isReduceMotionEnabled || typeof jest !== 'undefined') {
      slide.setValue(toVisible ? 1 : 0);
      scrimOpacity.setValue(toVisible ? 1 : 0);
      actionsReveal.setValue(toVisible ? 1 : 0);
      onFinished?.();
      return;
    }

    Animated.parallel([
      Animated.timing(slide, {
        toValue: toVisible ? 1 : 0,
        duration: toVisible ? 320 : 220,
        easing: toVisible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, {
        toValue: toVisible ? 1 : 0,
        duration: toVisible ? 240 : 180,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      // Delayed so the controls settle after the sheet itself has arrived,
      // matching the guided-reflection goal editor.
      Animated.sequence([
        Animated.delay(toVisible ? 130 : 0),
        Animated.timing(actionsReveal, {
          toValue: toVisible ? 1 : 0,
          duration: toVisible ? 220 : 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) {
        onFinished?.();
      }
    });
  };

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setIsMounted(true);
      isClosingRef.current = false;

      setTitle(goal?.title ?? '');
      setDescription(goal?.description ?? '');
      setIcon(goal?.icon ?? DEFAULT_GOAL_ICON);
      setIconSource(goal?.iconSource ?? (goal ? 'fixed' : 'automatic'));
      setFrequency(goal?.frequency ?? 'daily');
      setReminderEnabled(goal?.reminderEnabled ?? false);
      setReminderTime(goal?.reminderTime ?? DEFAULT_REMINDER_TIME);
      setIsTimeMenuOpen(false);
      setIsPermissionBlocked(false);

      slide.setValue(0);
      dragY.setValue(0);
      dragStartRef.current = 0;
      scrimOpacity.setValue(0);
      actionsReveal.setValue(0);
      reminderCardReveal.setValue(
        (goal?.frequency ?? 'daily') === 'as_needed' ? 0 : 1,
      );
      reminderDetailsReveal.setValue(goal?.reminderEnabled ? 1 : 0);
      timeMenuReveal.setValue(0);
      triggerHaptic('bottomSheet').catch(() => undefined);
      requestAnimationFrame(() => animateSheet(true));
    }

    if (!visible && wasVisibleRef.current && !isClosingRef.current) {
      isClosingRef.current = true;
      animateSheet(false, () => {
        setIsMounted(false);
        isClosingRef.current = false;
      });
    }

    wasVisibleRef.current = visible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Automatic mode remains live after reopening and after later title edits.
  useEffect(() => {
    if (iconSource !== 'automatic') {
      return;
    }

    setIcon(resolveUniqueGoalIcon(title, unavailableIcons));
  }, [iconSource, title, unavailableIcons]);

  useEffect(() => {
    let isActive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (isActive) {
          setIsReduceMotionEnabled(enabled);
        }
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsReduceMotionEnabled,
    );

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  const animateValue = useCallback(
    (value: Animated.Value, target: number, duration = 200) => {
      value.stopAnimation();

      if (isReduceMotionEnabled || typeof jest !== 'undefined') {
        value.setValue(target);
        return;
      }

      Animated.timing(value, {
        toValue: target,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    },
    [isReduceMotionEnabled],
  );

  useEffect(() => {
    animateValue(reminderCardReveal, supportsReminder ? 1 : 0, 220);
  }, [animateValue, reminderCardReveal, supportsReminder]);

  useEffect(() => {
    animateValue(
      reminderDetailsReveal,
      supportsReminder && reminderEnabled ? 1 : 0,
      210,
    );

    if (!supportsReminder || !reminderEnabled) {
      setIsTimeMenuOpen(false);
    }
  }, [animateValue, reminderDetailsReveal, reminderEnabled, supportsReminder]);

  useEffect(() => {
    animateValue(timeMenuReveal, isTimeMenuOpen ? 1 : 0, 190);
  }, [animateValue, isTimeMenuOpen, timeMenuReveal]);

  const pulseSelection = (value: Animated.Value) => {
    value.stopAnimation();

    if (isReduceMotionEnabled || typeof jest !== 'undefined') {
      value.setValue(1);
      return;
    }

    value.setValue(0);
    Animated.spring(value, {
      toValue: 1,
      damping: 16,
      stiffness: 220,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  };

  const requestClose = () => {
    if (isBusyRef.current) {
      return;
    }

    triggerHaptic('secondaryAction').catch(() => undefined);
    onClose();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.4,
      onPanResponderGrant: () => {
        dragY.stopAnimation(value => {
          dragStartRef.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        dragY.setValue(Math.max(0, dragStartRef.current + gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        const offset = Math.max(0, dragStartRef.current + gesture.dy);

        if (offset > 120 || gesture.vy > 1.1) {
          requestClose();
          return;
        }

        Animated.spring(dragY, {
          toValue: 0,
          damping: 22,
          stiffness: 185,
          mass: 0.9,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle.length > 0 && !isBusy;

  const requestDelete = () => {
    if (!goal || !isArchived || isBusy || !onDelete) {
      return;
    }

    triggerHaptic('secondaryAction').catch(() => undefined);
    Alert.alert(
      'Delete goal?',
      'This archived goal will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(goal),
        },
      ],
    );
  };

  const handleToggleReminder = async (nextEnabled: boolean) => {
    triggerHaptic('optionSelected').catch(() => undefined);
    setReminderEnabled(nextEnabled);

    if (!nextEnabled) {
      setIsPermissionBlocked(false);
      return;
    }

    // Permission is only ever asked for here — on explicit intent, never from a
    // background sync.
    try {
      const alreadyGranted = await getReminderPermissionGranted();
      const granted = alreadyGranted || (await requestReminderPermission());

      // Keep the preference on even when denied, so it starts working the moment
      // notifications are allowed in Settings.
      setIsPermissionBlocked(!granted);
    } catch {
      setIsPermissionBlocked(true);
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    triggerHaptic('primaryAction').catch(() => undefined);
    onSubmit({
      title: trimmedTitle,
      description: description.trim() || null,
      icon,
      iconSource,
      frequency,
      reminderEnabled: supportsReminder && reminderEnabled,
      reminderTime: supportsReminder && reminderEnabled ? reminderTime : null,
    });
  };

  const sheetTranslateY = useMemo(
    () =>
      Animated.add(
        slide.interpolate({ inputRange: [0, 1], outputRange: [360, 0] }),
        dragY,
      ),
    [dragY, slide],
  );

  const actionsStyle = {
    opacity: actionsReveal,
    transform: [
      {
        translateY: actionsReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  };
  const iconSelectionScale = iconSelectionPulse.interpolate({
    inputRange: [0, 0.65, 1],
    outputRange: [0.94, 1.05, 1],
  });
  const frequencySelectionScale = frequencySelectionPulse.interpolate({
    inputRange: [0, 0.65, 1],
    outputRange: [0.97, 1.035, 1],
  });
  const reminderCardMaxHeight = reminderCardReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 620],
  });
  const reminderDetailsMaxHeight = reminderDetailsReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 520],
  });
  const timeMenuMaxHeight = timeMenuReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 380],
  });
  const timeChevronRotation = timeMenuReveal.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={requestClose}
      transparent
      visible={isMounted}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]}>
          <HapticPressable
            accessibilityLabel="Dismiss"
            onPress={requestClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.card,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View {...panResponder.panHandlers} style={styles.grabArea}>
            <View
              style={[styles.grabber, { backgroundColor: theme.colors.border }]}
            />
            <Text style={[styles.title, { color: theme.colors.foreground }]}>
              {mode === 'edit' ? 'Edit goal' : 'Add goal'}
            </Text>
          </View>

          {/* The sheet now carries description, frequency, icon and reminder
              controls, so it can outgrow a small screen with the keyboard up. */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
          >
            <Text
              style={[styles.label, { color: theme.colors.mutedForeground }]}
            >
              Goal
            </Text>
            <View style={styles.titleInputRow}>
              <TextInput
                autoFocus={mode === 'add'}
                editable={!isBusy}
                maxLength={GOAL_TITLE_MAX}
                onChangeText={setTitle}
                placeholder="e.g. Journal every evening"
                placeholderTextColor={theme.colors.mutedForeground}
                style={[
                  styles.input,
                  styles.titleInput,
                  {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.border,
                    color: theme.colors.foreground,
                  },
                ]}
                value={title}
              />
              <View
                accessibilityLabel={`Selected goal icon ${icon}`}
                style={[
                  styles.iconPreview,
                  {
                    backgroundColor: hexToRgba(theme.colors.primary, 0.12),
                    borderColor: hexToRgba(theme.colors.primary, 0.3),
                  },
                ]}
              >
                <EmojiWithFallback
                  emoji={GOAL_ICON_EMOJI[icon]}
                  emojiStyle={styles.iconPreviewEmoji}
                  fallbackIcon={Target}
                  fallbackIconColor={theme.colors.primary}
                  fallbackIconSize={20}
                />
              </View>
            </View>

            <Text
              style={[styles.label, { color: theme.colors.mutedForeground }]}
            >
              Why it matters (optional)
            </Text>
            <TextInput
              editable={!isBusy}
              maxLength={GOAL_DESCRIPTION_MAX}
              multiline
              onChangeText={setDescription}
              placeholder="One line about what this looks like."
              placeholderTextColor={theme.colors.mutedForeground}
              style={[
                styles.input,
                styles.descriptionInput,
                {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.border,
                  color: theme.colors.foreground,
                },
              ]}
              textAlignVertical="top"
              value={description}
            />

            <Animated.View style={actionsStyle}>
              <Text
                style={[styles.label, { color: theme.colors.mutedForeground }]}
              >
                Icon
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.iconRow}
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        scale:
                          iconSource === 'automatic' ? iconSelectionScale : 1,
                      },
                    ],
                  }}
                >
                  <HapticPressable
                    accessibilityRole="button"
                    accessibilityLabel="Use automatic goal icon"
                    accessibilityState={{
                      selected: iconSource === 'automatic',
                    }}
                    onPress={() => {
                      triggerHaptic('optionSelected').catch(() => undefined);
                      setIconSource('automatic');
                      setIcon(resolveUniqueGoalIcon(title, unavailableIcons));
                      pulseSelection(iconSelectionPulse);
                    }}
                    style={({ pressed }) => [
                      styles.iconChip,
                      styles.autoIconChip,
                      {
                        backgroundColor:
                          iconSource === 'automatic'
                            ? hexToRgba(theme.colors.primary, 0.16)
                            : theme.colors.secondary,
                        borderColor:
                          iconSource === 'automatic'
                            ? theme.colors.primary
                            : theme.colors.border,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <X size={17} color={theme.colors.primary} strokeWidth={2} />
                  </HapticPressable>
                </Animated.View>
                {GOAL_ICON_PICKER_ORDER.map(key => {
                  const isSelected = iconSource === 'fixed' && key === icon;

                  return (
                    <Animated.View
                      key={key}
                      style={{
                        transform: [
                          { scale: isSelected ? iconSelectionScale : 1 },
                        ],
                      }}
                    >
                      <HapticPressable
                        accessibilityRole="button"
                        accessibilityLabel={`Goal icon ${key}`}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => {
                          triggerHaptic('optionSelected').catch(
                            () => undefined,
                          );
                          setIconSource('fixed');
                          setIcon(key);
                          pulseSelection(iconSelectionPulse);
                        }}
                        style={({ pressed }) => [
                          styles.iconChip,
                          {
                            backgroundColor: isSelected
                              ? hexToRgba(theme.colors.primary, 0.16)
                              : theme.colors.secondary,
                            borderColor: isSelected
                              ? theme.colors.primary
                              : theme.colors.border,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <EmojiWithFallback
                          emoji={GOAL_ICON_EMOJI[key]}
                          emojiStyle={styles.iconEmoji}
                          fallbackIcon={Target}
                          fallbackIconColor={theme.colors.primary}
                          fallbackIconSize={18}
                        />
                      </HapticPressable>
                    </Animated.View>
                  );
                })}
              </ScrollView>

              <Text
                style={[styles.label, { color: theme.colors.mutedForeground }]}
              >
                Repeats
              </Text>
              <View style={styles.frequencyRow}>
                {GOAL_FREQUENCIES.map(value => {
                  const isSelected = value === frequency;

                  return (
                    <Animated.View
                      key={value}
                      style={[
                        styles.frequencyItem,
                        {
                          transform: [
                            { scale: isSelected ? frequencySelectionScale : 1 },
                          ],
                        },
                      ]}
                    >
                      <HapticPressable
                        accessibilityRole="button"
                        accessibilityLabel={GOAL_FREQUENCY_LABELS[value]}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => {
                          triggerHaptic('optionSelected').catch(
                            () => undefined,
                          );
                          setFrequency(value);
                          pulseSelection(frequencySelectionPulse);
                        }}
                        style={({ pressed }) => [
                          styles.frequencyChip,
                          {
                            backgroundColor: isSelected
                              ? hexToRgba(theme.colors.primary, 0.14)
                              : theme.colors.secondary,
                            borderColor: isSelected
                              ? theme.colors.primary
                              : theme.colors.border,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.frequencyText,
                            {
                              color: isSelected
                                ? theme.colors.primary
                                : theme.colors.mutedForeground,
                            },
                          ]}
                        >
                          {GOAL_FREQUENCY_LABELS[value]}
                        </Text>
                      </HapticPressable>
                    </Animated.View>
                  );
                })}
              </View>

              <Animated.View
                pointerEvents={supportsReminder ? 'auto' : 'none'}
                style={[
                  styles.revealClip,
                  {
                    maxHeight: reminderCardMaxHeight,
                    opacity: reminderCardReveal,
                    transform: [
                      {
                        translateY: reminderCardReveal.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-8, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View
                  style={[
                    styles.reminderCard,
                    {
                      backgroundColor: theme.colors.secondary,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.reminderHeader}>
                    <Bell size={16} color={theme.colors.primary} />
                    <View style={styles.reminderCopy}>
                      <Text
                        style={[
                          styles.reminderTitle,
                          { color: theme.colors.foreground },
                        ]}
                      >
                        Remind me
                      </Text>
                      <Text
                        style={[
                          styles.reminderBody,
                          { color: theme.colors.mutedForeground },
                        ]}
                      >
                        Only if it isn't done yet.
                      </Text>
                    </View>
                    <HapticSwitch
                      accessibilityLabel="Remind me about this goal"
                      onValueChange={value => {
                        handleToggleReminder(value).catch(() => undefined);
                      }}
                      thumbColor={theme.colors.card}
                      trackColor={{
                        false: theme.colors.border,
                        true: theme.colors.primary,
                      }}
                      value={reminderEnabled}
                    />
                  </View>

                  <Animated.View
                    pointerEvents={reminderEnabled ? 'auto' : 'none'}
                    style={[
                      styles.revealClip,
                      {
                        maxHeight: reminderDetailsMaxHeight,
                        opacity: reminderDetailsReveal,
                        transform: [
                          {
                            translateY: reminderDetailsReveal.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-6, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View>
                      <HapticPressable
                        accessibilityRole="button"
                        accessibilityLabel="Choose reminder time"
                        onPress={() => {
                          triggerHaptic('optionSelected').catch(
                            () => undefined,
                          );
                          setIsTimeMenuOpen(previous => !previous);
                        }}
                        style={({ pressed }) => [
                          styles.timeButton,
                          {
                            backgroundColor: theme.colors.card,
                            borderColor: theme.colors.border,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.timeButtonText,
                            { color: theme.colors.foreground },
                          ]}
                        >
                          {formatReminderTime(reminderTime)}
                        </Text>
                        <Animated.View
                          style={{
                            transform: [{ rotate: timeChevronRotation }],
                          }}
                        >
                          <ChevronDown
                            size={16}
                            color={theme.colors.mutedForeground}
                          />
                        </Animated.View>
                      </HapticPressable>

                      <Animated.View
                        pointerEvents={isTimeMenuOpen ? 'auto' : 'none'}
                        style={[
                          styles.revealClip,
                          {
                            maxHeight: timeMenuMaxHeight,
                            opacity: timeMenuReveal,
                            transform: [
                              {
                                translateY: timeMenuReveal.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [-6, 0],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.timeMenu,
                            {
                              backgroundColor: theme.colors.card,
                              borderColor: theme.colors.border,
                            },
                          ]}
                        >
                          {REMINDER_TIME_OPTIONS.map(option => {
                            const isSelected = option.value === reminderTime;

                            return (
                              <HapticPressable
                                key={option.value}
                                accessibilityRole="button"
                                accessibilityLabel={option.label}
                                onPress={() => {
                                  triggerHaptic('optionSelected').catch(
                                    () => undefined,
                                  );
                                  setReminderTime(option.value);
                                  setIsTimeMenuOpen(false);
                                }}
                                style={({ pressed }) => [
                                  styles.timeOption,
                                  pressed && styles.pressed,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.timeOptionText,
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
                                  <Check
                                    size={14}
                                    color={theme.colors.primary}
                                  />
                                ) : null}
                              </HapticPressable>
                            );
                          })}
                        </View>
                      </Animated.View>

                      {isPermissionBlocked ? (
                        <HapticPressable
                          accessibilityRole="button"
                          accessibilityLabel="Open notification settings"
                          onPress={() => {
                            Linking.openSettings().catch(() => undefined);
                          }}
                          style={({ pressed }) => [pressed && styles.pressed]}
                        >
                          <Text
                            style={[
                              styles.permissionNote,
                              { color: theme.colors.destructive },
                            ]}
                          >
                            Notifications are off for Journal.IO. Tap to open
                            Settings — this reminder will start working once
                            they're allowed.
                          </Text>
                        </HapticPressable>
                      ) : null}
                    </View>
                  </Animated.View>
                </View>
              </Animated.View>
            </Animated.View>

            {errorMessage ? (
              <Text style={[styles.error, { color: theme.colors.destructive }]}>
                {errorMessage}
              </Text>
            ) : null}

            <HapticPressable
              accessibilityRole="button"
              accessibilityLabel={mode === 'edit' ? 'Save goal' : 'Add goal'}
              accessibilityState={{ busy: isSubmitting, disabled: !canSubmit }}
              disabled={!canSubmit}
              onPress={handleSubmit}
              style={[
                styles.saveButton,
                {
                  backgroundColor: canSubmit
                    ? theme.colors.primary
                    : theme.colors.muted,
                },
              ]}
            >
              <ButtonLoadingContent
                loaderColor={theme.colors.primaryForeground}
                loading={isSubmitting}
              >
                <Text
                  style={[
                    styles.saveButtonText,
                    {
                      color: canSubmit
                        ? theme.colors.primaryForeground
                        : theme.colors.mutedForeground,
                    },
                  ]}
                >
                  {mode === 'edit' ? 'Save changes' : 'Add goal'}
                </Text>
              </ButtonLoadingContent>
            </HapticPressable>

            {/* Callers that edit a goal which is not saved yet (AI goal
                suggestions) pass no lifecycle handlers, so the row is hidden
                rather than offering to archive something that does not exist. */}
            {mode === 'edit' && goal && hasLifecycleActions ? (
              <Animated.View style={[styles.lifecycleRow, actionsStyle]}>
                {isArchived ? (
                  <>
                    <HapticPressable
                      accessibilityRole="button"
                      accessibilityLabel={`Unarchive goal ${goal.title}`}
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      onPress={() => onUnarchive?.(goal)}
                      style={({ pressed }) => [
                        styles.lifecycleButton,
                        {
                          backgroundColor: hexToRgba(theme.colors.success, 0.1),
                          borderColor: hexToRgba(theme.colors.success, 0.24),
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <ArchiveRestore size={15} color={theme.colors.success} />
                      <Text
                        style={[
                          styles.lifecycleText,
                          { color: theme.colors.success },
                        ]}
                      >
                        Unarchive
                      </Text>
                    </HapticPressable>
                    {onDelete ? (
                      <HapticPressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete goal ${goal.title}`}
                        accessibilityState={{
                          busy: isDeleting,
                          disabled: isBusy,
                        }}
                        disabled={isBusy}
                        onPress={requestDelete}
                        style={({ pressed }) => [
                          styles.lifecycleButton,
                          {
                            backgroundColor: hexToRgba(
                              theme.colors.destructive,
                              0.08,
                            ),
                            borderColor: hexToRgba(
                              theme.colors.destructive,
                              0.22,
                            ),
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <ButtonLoadingContent
                          contentStyle={styles.lifecycleButtonContent}
                          loaderColor={theme.colors.destructive}
                          loading={isDeleting}
                          style={styles.lifecycleLoadingContent}
                        >
                          <Trash2 size={15} color={theme.colors.destructive} />
                          <Text
                            style={[
                              styles.lifecycleText,
                              { color: theme.colors.destructive },
                            ]}
                          >
                            Delete
                          </Text>
                        </ButtonLoadingContent>
                      </HapticPressable>
                    ) : null}
                  </>
                ) : (
                  <HapticPressable
                    accessibilityRole="button"
                    accessibilityLabel={`Archive goal ${goal.title}`}
                    accessibilityState={{ disabled: isBusy }}
                    disabled={isBusy}
                    onPress={() => onArchive?.(goal)}
                    style={({ pressed }) => [
                      styles.lifecycleButton,
                      {
                        backgroundColor: hexToRgba(theme.colors.warning, 0.1),
                        borderColor: hexToRgba(theme.colors.warning, 0.24),
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Archive size={15} color={theme.colors.warning} />
                    <Text
                      style={[
                        styles.lifecycleText,
                        { color: theme.colors.warning },
                      ]}
                    >
                      Archive goal
                    </Text>
                  </HapticPressable>
                )}
              </Animated.View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45, 42, 38, 0.32)',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '88%',
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#2D2A26',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  grabArea: {
    paddingBottom: 4,
  },
  grabber: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 4,
    marginBottom: 14,
    width: 42,
  },
  scroll: {
    flexGrow: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 18,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  titleInputRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 10,
  },
  titleInput: {
    flex: 1,
  },
  iconPreview: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    width: 48,
  },
  iconPreviewEmoji: {
    fontSize: 22,
    letterSpacing: -0.5,  },
  descriptionInput: {
    minHeight: 76,
  },
  iconRow: {
    gap: 8,
    paddingVertical: 2,
  },
  iconChip: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  autoIconChip: {
    borderStyle: 'dashed',
  },
  iconEmoji: {
    fontSize: 20,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyItem: {
    flex: 1,
  },
  frequencyChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  frequencyText: {
    fontSize: 13,
    fontWeight: '700',
  },
  revealClip: {
    overflow: 'hidden',
  },
  reminderCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginTop: 18,
    padding: 14,
  },
  reminderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  reminderCopy: {
    flex: 1,
    gap: 1,
  },
  reminderTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  reminderBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  timeButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  timeButtonText: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  timeMenu: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  timeOption: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  timeOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  permissionNote: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  error: {
    fontSize: 13,
    marginTop: 14,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 48,
    overflow: 'hidden',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  lifecycleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 14,
  },
  lifecycleButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  lifecycleButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  lifecycleLoadingContent: {
    minHeight: 40,
    width: '100%',
  },
  lifecycleText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
