import HapticPressable from '../components/HapticPressable';
import {
  useCallback,
  useEffect,
  useRef,
  useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Text,
  TextInput,
} from "../infrastructure/reactNative";
import { ArrowLeft, RefreshCw, Save } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import ConfirmActionSheet from "../components/ConfirmActionSheet";
import GuidedFinishLoader from "../components/GuidedFinishLoader";
import KeyboardDismissAccessory from "../components/KeyboardDismissAccessory";
import ShimmerBlock from "../components/ShimmerBlock";
import {
  createJournalEntry,
  getJournalSessionAnalysis,
} from "../services/journalService";
import type { GuidedReflectionSessionAnalysisResponse } from "../services/guidedReflectionService";
import {
  getWritingPrompts,
  type WritingPrompt,
} from "../services/promptsService";
import { getPrimaryDailyReminder } from "../services/remindersService";
import {
  cancelWeeklyInsightNotifications,
  syncReminderNotifications,
} from "../services/reminderNotificationsService";
import { triggerHaptic } from "../services/hapticsService";
import { useAppStore } from "../store/appStore";
import { navigateMainApp } from "../navigation/navigation";
import { useTheme } from "../theme/provider";
import { useConnectivity } from "../hooks/useConnectivity";
import { fontFamilies } from "../theme/typography";

type NewEntryScreenProps = {
  onBack: () => void;
  initialPrompt?: string | null;
};

// Offline/error fallback only. Kept short so it reads the same as the
// AI-generated prompts in the single-line prompt slot.
const DEFAULT_WRITING_PROMPTS: WritingPrompt[] = [
  {
    id: "reflection-1",
    topic: "Reflection",
    text: "What felt steady today?",
  },
  {
    id: "patterns-2",
    topic: "Patterns",
    text: "Where did your mood shift?",
  },
  {
    id: "next-step-3",
    topic: "Next Step",
    text: "What do you want to carry into tomorrow?",
  },
];

const TODAYS_REFLECTION_PROMPT_ID = "todays-reflection";
const UNTITLED_ENTRY_TITLE = "Untitled";
const NEW_ENTRY_KEYBOARD_ACCESSORY_ID = "new-entry-keyboard-actions";
const PROMPT_SLOT_HEIGHT = 26;
const PROMPT_WHEEL_DURATION_MS = 320;
const PROMPT_INSERT_PULSE_MS = 520;
const SAVE_HIGHLIGHT_DURATION_MS = 220;
const MIN_FINISH_DWELL_MS = 1500;

function waitOutFinishDwell(startedAt: number) {
  const remaining = MIN_FINISH_DWELL_MS - (Date.now() - startedAt);

  if (remaining <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>(resolve => setTimeout(resolve, remaining));
}

function toRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function mergePrompts(existing: WritingPrompt[], incoming: WritingPrompt[]) {
  const seen = new Set(
    existing.map(prompt => prompt.text.trim().toLowerCase())
  );

  return [
    ...existing,
    ...incoming.filter(prompt => {
      const key = prompt.text.trim().toLowerCase();

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    }),
  ];
}

export default function NewEntryScreen({
  onBack,
  initialPrompt,
}: NewEntryScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { status: connectivityStatus } = useConnectivity();
  const isOnline = connectivityStatus === "online";
  const { width } = useWindowDimensions();
  const addRecentJournalEntry = useAppStore(
    state => state.addRecentJournalEntry
  );
  const returnHomeFromJournalFlow = useAppStore(
    state => state.returnHomeFromJournalFlow
  );
  const isPremium = useAppStore(state =>
    Boolean(state.session?.user.isPremium)
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  /**
   * Every prompt the app has inserted into the body, not just the last one.
   * `selectedPrompt` feeds `aiPrompt`, which holds a single value — so in a
   * multi-prompt entry the earlier prompts would otherwise be unrecoverable app
   * text sitting inside the user's writing, read back as their own words.
   */
  const [insertedPrompts, setInsertedPrompts] = useState<string[]>([]);
  // Starts empty so the card shimmers instead of flashing a placeholder prompt
  // the user never asked for.
  const [writingPrompts, setWritingPrompts] = useState<WritingPrompt[]>([]);
  const [hasResolvedPrompts, setHasResolvedPrompts] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  // The prompt that is on its way out of the slot. The prompt that stays is
  // always `writingPrompts[promptIndex]`, committed the instant the wheel
  // starts — see `advancePrompt`.
  const [outgoingPrompt, setOutgoingPrompt] = useState<WritingPrompt | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 1 is the resting state: the visible prompt sits still in the slot. Each
  // advance drops it to 0 and animates back to 1, so the wheel never has to be
  // reset after the fact.
  const promptWheel = useRef(new Animated.Value(1)).current;
  const promptInsert = useRef(new Animated.Value(0)).current;
  const saveHighlight = useRef(new Animated.Value(0)).current;
  const contentInputRef = useRef<TextInput | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const isFetchingPromptsRef = useRef(false);
  const hasLoadedPromptsRef = useRef(false);

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 20;
  const sheetMaxWidth = isWide ? 460 : 420;

  const activePrompt = writingPrompts[promptIndex] ?? null;
  const hasContent = content.trim().length > 0;
  const isSaveReady = isOnline && !isSaving && hasContent;
  const isLoadingPrompt = !hasResolvedPrompts && !activePrompt;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => mounted && setReduceMotion(enabled))
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const fetchPrompts = useCallback(async () => {
    if (isFetchingPromptsRef.current) {
      return;
    }

    isFetchingPromptsRef.current = true;

    try {
      const response = await getWritingPrompts();

      if (response.prompts.length === 0) {
        return;
      }

      setWritingPrompts(previous => {
        // The first successful load fills the empty slot; later background
        // refills append so the wheel keeps producing text the user has not
        // seen. Either way a seeded reflection keeps its place at the front.
        if (!hasLoadedPromptsRef.current) {
          hasLoadedPromptsRef.current = true;
          const seeded = previous.filter(
            prompt => prompt.id === TODAYS_REFLECTION_PROMPT_ID
          );
          return mergePrompts(seeded, response.prompts);
        }

        return mergePrompts(previous, response.prompts);
      });
    } catch {
      // The composer must stay usable offline, so the local prompts stand in —
      // but only on failure, never as a placeholder before the first response.
      setWritingPrompts(previous =>
        hasLoadedPromptsRef.current
          ? previous
          : mergePrompts(previous, DEFAULT_WRITING_PROMPTS)
      );
      hasLoadedPromptsRef.current = true;
    } finally {
      isFetchingPromptsRef.current = false;
      setHasResolvedPrompts(true);
    }
  }, []);

  useEffect(() => {
    fetchPrompts().catch(() => undefined);
  }, [fetchPrompts]);

  // "Today's reflection" from Home now seeds the prompt slot rather than the
  // body, so the user chooses whether it becomes part of the entry.
  useEffect(() => {
    const trimmedPrompt = initialPrompt?.trim();

    if (!trimmedPrompt) {
      return;
    }

    setWritingPrompts(previous => {
      if (previous.some(prompt => prompt.id === TODAYS_REFLECTION_PROMPT_ID)) {
        return previous;
      }

      return [
        {
          id: TODAYS_REFLECTION_PROMPT_ID,
          topic: "Today's reflection",
          text: trimmedPrompt,
        },
        ...previous,
      ];
    });
    setPromptIndex(0);
  }, [initialPrompt]);

  useEffect(() => {
    Animated.timing(saveHighlight, {
      toValue: isSaveReady ? 1 : 0,
      duration: reduceMotion ? 0 : SAVE_HIGHLIGHT_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isSaveReady, reduceMotion, saveHighlight]);

  /**
   * The slot-machine step: the outgoing prompt travels down out of the slot
   * while the new one drops in from above.
   *
   * The new prompt is committed to state *before* the animation runs, and the
   * layer that keeps it lands exactly on the resting style. Swapping the text
   * in the animation's end callback instead meant a React commit and a
   * native-driver reset landing in different UI transactions, so the new prompt
   * painted for a frame at the old transform and then snapped into place.
   */
  const advancePrompt = useCallback(() => {
    if (writingPrompts.length === 0) {
      return;
    }

    const current = writingPrompts[promptIndex] ?? null;
    const nextIndex = (promptIndex + 1) % writingPrompts.length;

    // Wrapping means the batch is spent — quietly top it up so repeated taps
    // keep surfacing prompts the user has not seen.
    if (nextIndex === 0) {
      fetchPrompts().catch(() => undefined);
    }

    // Committed straight away, so back-to-back taps each advance by one rather
    // than recomputing the same index off a value that has not landed yet.
    setPromptIndex(nextIndex);

    if (reduceMotion) {
      setOutgoingPrompt(null);
      promptWheel.setValue(1);
      return;
    }

    promptWheel.stopAnimation();
    setOutgoingPrompt(current);
    promptWheel.setValue(0);
    Animated.timing(promptWheel, {
      toValue: 1,
      duration: PROMPT_WHEEL_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      // Only drops the (already invisible) outgoing copy — the prompt on show
      // is untouched, so nothing moves when the wheel lands.
      setOutgoingPrompt(null);
    });
  }, [
    fetchPrompts,
    promptIndex,
    promptWheel,
    reduceMotion,
    writingPrompts,
  ]);

  const handleRefreshPrompt = () => {
    triggerHaptic("secondaryAction").catch(() => undefined);
    advancePrompt();
  };

  const handleUsePrompt = () => {
    if (!activePrompt) {
      return;
    }

    const promptText = activePrompt.text.trim();
    triggerHaptic("optionSelected").catch(() => undefined);

    // The text lands in the entry on the tap itself; the motion below shows
    // where it went rather than gating the insert behind an animation.
    setSelectedPrompt(promptText);
    setInsertedPrompts(previous =>
      previous.includes(promptText) ? previous : [...previous, promptText]
    );
    setContent(previous =>
      previous.trim()
        ? `${previous.trimEnd()}\n\n${promptText}\n`
        : `${promptText}\n`
    );
    advancePrompt();

    if (reduceMotion) {
      return;
    }

    // The prompt slot clips, so the arrival is signalled on the destination:
    // the entry field pulses a primary ring as the text lands in it.
    promptInsert.setValue(0);
    Animated.sequence([
      Animated.timing(promptInsert, {
        toValue: 1,
        duration: PROMPT_INSERT_PULSE_MS * 0.35,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(promptInsert, {
        toValue: 0,
        duration: PROMPT_INSERT_PULSE_MS * 0.65,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const maybeSkipTodaysReminder = async () => {
    try {
      const reminder = await getPrimaryDailyReminder();

      if (!reminder?.enabled || !reminder.skipIfCompletedToday) {
        return;
      }

      await syncReminderNotifications(reminder, {
        skipToday: true,
      });
    } catch {
      // Entry creation should not fail if reminder sync is unavailable.
    }
  };

  const handleSavePress = () => {
    if (!isSaveReady) {
      return;
    }

    Keyboard.dismiss();
    setIsConfirmVisible(true);
    triggerHaptic("bottomSheet").catch(() => undefined);
  };

  const handleWriteMore = () => {
    setIsConfirmVisible(false);
    triggerHaptic("secondaryAction").catch(() => undefined);
    setTimeout(() => contentInputRef.current?.focus(), 220);
  };

  const handleSave = async () => {
    const trimmedContent = content.trim();

    if (!isOnline || isSaving) {
      return;
    }

    if (!trimmedContent) {
      setError("Please write something before saving.");
      return;
    }

    setIsSaving(true);
    setError(null);
    triggerHaptic("primaryAction").catch(() => undefined);
    const finishStartedAt = Date.now();

    try {
      const savedEntry = await createJournalEntry({
        title: title.trim() || UNTITLED_ENTRY_TITLE,
        content: trimmedContent,
        type: "open_ended",
        aiPrompt: selectedPrompt || undefined,
        appAuthoredSegments: insertedPrompts,
        tags: [],
      });

      addRecentJournalEntry(savedEntry);
      // The entry is already persisted, so notification bookkeeping must never
      // reach the catch below — a rejection there showed a save error on a
      // saved entry and invited a duplicate save.
      maybeSkipTodaysReminder().catch(() => undefined);
      cancelWeeklyInsightNotifications().catch(() => undefined);

      // Mirrors the guided reflection finish step: the analysis is fetched here,
      // behind the inline button loader, so the next screen opens with its data
      // already in hand and plays its reveal instead of a loading spinner.
      let sessionAnalysis: GuidedReflectionSessionAnalysisResponse | undefined;

      if (Platform.OS === "ios" && savedEntry._id && isPremium) {
        try {
          sessionAnalysis = await getJournalSessionAnalysis(savedEntry._id);
        } catch {
          // The entry is saved either way — the analysis screen falls back to
          // its own fetch/retry rather than blocking the save.
        }
      }

      // Free users have no analysis call to wait on, so without a floor the
      // lock screen would snap in the instant the entry saves. This holds the
      // finish loader for the remainder of the beat; a slower premium fetch
      // has already covered it and waits no longer.
      await waitOutFinishDwell(finishStartedAt);

      setIsConfirmVisible(false);
      setIsSaving(false);
      returnHomeFromJournalFlow();

      // iOS keeps the post-save analysis beat in the journal flow. Free users
      // receive the local obscured preview; Android intentionally returns Home.
      if (Platform.OS === "ios" && savedEntry._id) {
        triggerHaptic("personalizationComplete").catch(() => undefined);
        navigateMainApp("EntrySessionAnalysis", {
          journalId: savedEntry._id,
          sessionAnalysis,
        });
      }
    } catch (saveError) {
      setIsSaving(false);
      setIsConfirmVisible(false);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save this entry right now."
      );
    }
  };

  const revealWritingArea = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 310, animated: true });
    }, 120);
  };

  // The prompt that stays: drops in from above and settles at the resting
  // style, which is where the wheel already sits between advances.
  const activePromptStyle = {
    opacity: promptWheel,
    transform: [
      {
        translateY: promptWheel.interpolate({
          inputRange: [0, 1],
          outputRange: [-PROMPT_SLOT_HEIGHT, 0],
        }),
      },
    ],
  } as const;

  // The copy of the previous prompt, mounted only while the wheel is turning.
  const outgoingPromptStyle = {
    opacity: promptWheel.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
    transform: [
      {
        translateY: promptWheel.interpolate({
          inputRange: [0, 1],
          outputRange: [0, PROMPT_SLOT_HEIGHT],
        }),
      },
      {
        scale: promptWheel.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.96],
        }),
      },
    ],
  } as const;

  const refreshSpinStyle = {
    transform: [
      {
        rotate: promptWheel.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "360deg"],
        }),
      },
    ],
  } as const;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.screen}>
          <View
            style={[
              styles.header,
              {
                paddingHorizontal: horizontalPadding,
                maxWidth: sheetMaxWidth,
              },
            ]}
          >
            <HapticPressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={onBack}
              style={({ pressed }) => [
                styles.headerIconButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                },
                pressed && styles.pressed,
              ]}
            >
              <ArrowLeft size={18} color={theme.colors.foreground} />
            </HapticPressable>

            <Text style={[styles.headerTitle, { color: theme.colors.foreground }]}>
              Open Entry
            </Text>

            {/* Balances the back button so the title stays optically centred
                now that Save has moved to the bottom of the screen. */}
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={[
              styles.content,
              styles.contentInset,
              {
                paddingHorizontal: horizontalPadding,
                backgroundColor: theme.colors.background,
              },
            ]}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.sheet, { maxWidth: sheetMaxWidth }]}>
              <View style={styles.section}>
                <TextInput
                  accessibilityLabel="Entry title"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Give your entry a title (optional)"
                  placeholderTextColor={theme.colors.mutedForeground}
                  autoCapitalize="sentences"
                  inputAccessoryViewID={NEW_ENTRY_KEYBOARD_ACCESSORY_ID}
                  style={[
                    styles.titleInput,
                    {
                      color: theme.colors.foreground,
                      borderBottomColor: theme.colors.border,
                    },
                  ]}
                />
              </View>

              <View style={styles.section}>
                <View style={styles.promptRow}>
                  <HapticPressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      activePrompt
                        ? `Add writing prompt to your entry: ${activePrompt.text}`
                        : "Writing prompt"
                    }
                    disabled={!activePrompt}
                    onPress={handleUsePrompt}
                    style={({ pressed }) => [
                      styles.promptCard,
                      {
                        backgroundColor: theme.colors.accent,
                        borderColor: theme.colors.border,
                      },
                      pressed && activePrompt && styles.pressed,
                    ]}
                  >
                    <View style={styles.promptSlot}>
                      {isLoadingPrompt ? (
                        <View
                          accessibilityLabel="Loading a writing prompt"
                          style={styles.promptShimmerStack}
                        >
                          <ShimmerBlock
                            baseColor={theme.colors.border}
                            highlightColor={theme.colors.card}
                            style={styles.promptShimmerLine}
                          />
                          <ShimmerBlock
                            baseColor={theme.colors.border}
                            highlightColor={theme.colors.card}
                            style={[
                              styles.promptShimmerLine,
                              styles.promptShimmerLineShort,
                            ]}
                          />
                        </View>
                      ) : null}
                      <Animated.Text
                        numberOfLines={1}
                        style={[
                          styles.promptText,
                          { color: theme.colors.foreground },
                          activePromptStyle,
                        ]}
                      >
                        {activePrompt?.text ?? ""}
                      </Animated.Text>
                      {outgoingPrompt ? (
                        <Animated.Text
                          numberOfLines={1}
                          style={[
                            styles.promptText,
                            styles.promptTextOverlay,
                            { color: theme.colors.foreground },
                            outgoingPromptStyle,
                          ]}
                        >
                          {outgoingPrompt.text}
                        </Animated.Text>
                      ) : null}
                    </View>
                  </HapticPressable>

                  <HapticPressable
                    accessibilityRole="button"
                    accessibilityLabel="Show another writing prompt"
                    onPress={handleRefreshPrompt}
                    style={({ pressed }) => [
                      styles.promptRefreshButton,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.card,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Animated.View style={refreshSpinStyle}>
                      <RefreshCw size={15} color={theme.colors.primary} />
                    </Animated.View>
                  </HapticPressable>
                </View>
              </View>

              <View style={styles.section}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.contentPulseRing,
                    {
                      borderColor: theme.colors.primary,
                      opacity: promptInsert,
                    },
                  ]}
                />
                <TextInput
                  ref={contentInputRef}
                  accessibilityLabel="Entry content"
                  value={content}
                  onChangeText={setContent}
                  placeholder="Start writing your thoughts..."
                  placeholderTextColor={theme.colors.mutedForeground}
                  multiline
                  autoFocus
                  inputAccessoryViewID={NEW_ENTRY_KEYBOARD_ACCESSORY_ID}
                  onFocus={revealWritingArea}
                  textAlignVertical="top"
                  style={[
                    styles.contentInput,
                    {
                      color: theme.colors.foreground,
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                />
              </View>

              {error ? (
                <View
                  style={[
                    styles.errorCard,
                    {
                      borderColor: theme.colors.destructive,
                      backgroundColor: toRgba(theme.colors.destructive, 0.08),
                    },
                  ]}
                >
                  <Text
                    style={[styles.errorText, { color: theme.colors.destructive }]}
                  >
                    {error}
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.saveDock,
              {
                bottom: insets.bottom + 16,
                right: horizontalPadding,
                transform: [
                  {
                    scale: saveHighlight.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <HapticPressable
              accessibilityRole="button"
              accessibilityLabel="Save entry"
              accessibilityState={{ busy: isSaving, disabled: !isSaveReady }}
              onPress={handleSavePress}
              disabled={!isSaveReady}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
                pressed && isSaveReady && styles.pressed,
              ]}
            >
              {/* backgroundColor cannot be driven natively, so the highlight is
                  a primary-coloured layer cross-fading over the muted base. */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.saveButtonFill,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: saveHighlight,
                  },
                ]}
              />
              {isSaving ? (
                <GuidedFinishLoader
                  active={isSaving}
                  color={theme.colors.primaryForeground}
                />
              ) : (
                <View style={styles.saveButtonContent}>
                  <View style={styles.saveIconStack}>
                    <Animated.View
                      style={{
                        opacity: saveHighlight.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0],
                        }),
                      }}
                    >
                      <Save size={14} color={theme.colors.mutedForeground} />
                    </Animated.View>
                    <Animated.View
                      style={[
                        styles.saveIconOverlay,
                        { opacity: saveHighlight },
                      ]}
                    >
                      <Save size={14} color={theme.colors.primaryForeground} />
                    </Animated.View>
                  </View>
                  <View>
                    <Animated.Text
                      style={[
                        styles.saveButtonText,
                        { color: theme.colors.mutedForeground },
                        {
                          opacity: saveHighlight.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 0],
                          }),
                        },
                      ]}
                    >
                      Save
                    </Animated.Text>
                    <Animated.Text
                      style={[
                        styles.saveButtonText,
                        styles.saveButtonTextOverlay,
                        {
                          color: theme.colors.primaryForeground,
                          opacity: saveHighlight,
                        },
                      ]}
                    >
                      Save
                    </Animated.Text>
                  </View>
                </View>
              )}
            </HapticPressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
      <KeyboardDismissAccessory
        nativeID={NEW_ENTRY_KEYBOARD_ACCESSORY_ID}
        backgroundColor={theme.colors.card}
        borderColor={theme.colors.border}
        actionColor={theme.colors.primary}
      />
      <ConfirmActionSheet
        body="You can keep adding to this entry, or finish and see what stood out."
        dismissAccessibilityLabel="Dismiss save confirmation"
        isSecondaryLoading={isSaving}
        onDismiss={() => {
          if (!isSaving) {
            setIsConfirmVisible(false);
          }
        }}
        onPrimary={handleWriteMore}
        onSecondary={() => {
          handleSave().catch(() => undefined);
        }}
        primaryLabel="Write more"
        secondaryLabel="Finish entry"
        // Same inline save progress the guided reflection finish step shows,
        // in place of a full-screen loader between here and the analysis.
        secondaryLoader={
          <GuidedFinishLoader
            active={isSaving}
            color={theme.colors.foreground}
          />
        }
        title="Finish this entry?"
        visible={isConfirmVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  header: {
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerSpacer: {
    width: 40,
    height: 40,
    flexShrink: 0,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  saveDock: {
    position: "absolute",
  },
  saveButton: {
    minWidth: 92,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    overflow: "hidden",
  },
  saveButtonFill: {
    ...StyleSheet.absoluteFillObject,
  },
  saveButtonContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },
  saveIconStack: {
    alignItems: "center",
    justifyContent: "center",
  },
  saveIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    fontFamily: fontFamilies.ui.semibold,
    fontSize: 13,
    fontWeight: "600",
  },
  saveButtonTextOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flexGrow: 1,
    paddingTop: 4,
  },
  contentInset: {
    paddingBottom: 96,
  },
  sheet: {
    width: "100%",
    alignSelf: "center",
  },
  section: {
    marginBottom: 16,
  },
  titleInput: {
    borderBottomWidth: 1,
    fontSize: 18,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  promptRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  promptCard: {
    borderWidth: 1,
    borderRadius: 14,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  promptSlot: {
    height: PROMPT_SLOT_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
  },
  promptText: {
    fontFamily: fontFamilies.ui.regular,
    fontSize: 13,
    lineHeight: PROMPT_SLOT_HEIGHT,
  },
  promptShimmerStack: {
    ...StyleSheet.absoluteFillObject,
    gap: 6,
    justifyContent: "center",
  },
  promptShimmerLine: {
    borderRadius: 999,
    height: 8,
    width: "100%",
  },
  promptShimmerLineShort: {
    width: "62%",
  },
  // The leaving copy is taken out of the flow so the slot's height is set by
  // the prompt that stays — the card can never resize mid-turn.
  promptTextOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  promptRefreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  contentPulseRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 2,
    zIndex: 1,
  },
  contentInput: {
    minHeight: 300,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 22,
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
