import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ArrowLeft,
  Check,
  Frown,
  Heart,
  Image as ImageIcon,
  Lock,
  Loader2,
  Mic,
  Save,
  Search,
  Smile,
  SmilePlus,
  Sparkles,
  Tag,
  X,
  Wand2,
  Meh,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createJournalEntry,
  suggestJournalTags as fetchSuggestedJournalTags,
} from "../services/journalService";
import { trackPaywallEvent } from "../services/paywallService";
import {
  getWritingPrompts,
  type WritingPrompt,
} from "../services/promptsService";
import { getPrimaryDailyReminder } from "../services/remindersService";
import { syncReminderNotifications } from "../services/reminderNotificationsService";
import { useAppStore } from "../store/appStore";
import { useTheme } from "../theme/provider";
import { ApiError } from "../utils/apiClient";

type MoodKey = "amazing" | "good" | "okay" | "bad" | "terrible";

type NewEntryScreenProps = {
  onBack: () => void;
  initialPrompt?: string | null;
};

type MoodOption = {
  value: MoodKey;
  icon: typeof Smile;
  label: string;
};

const DEFAULT_WRITING_PROMPTS: WritingPrompt[] = [
  {
    id: "reflection-1",
    topic: "Reflection",
    text: "What felt most steady or grounding in your day?",
  },
  {
    id: "patterns-2",
    topic: "Patterns",
    text: "Where did your mood shift, and what seemed to influence it?",
  },
  {
    id: "next-step-3",
    topic: "Next Step",
    text: "What is one small thing you want to carry into tomorrow?",
  },
];

const tagKeywords: Record<string, string[]> = {
  gratitude: ["grateful", "thankful", "appreciate", "blessed", "thanks"],
  anxiety: ["anxious", "worried", "nervous", "stress", "panic", "overwhelm"],
  happiness: ["happy", "joy", "excited", "wonderful", "amazing", "great"],
  sadness: ["sad", "cry", "lonely", "grief", "down", "upset"],
  reflection: ["think", "reflect", "realize", "learn", "insight", "looking back"],
  goals: ["goal", "plan", "achieve", "dream", "hope to", "aim"],
  mindfulness: ["mindful", "present", "breathe", "meditate", "calm", "peace"],
  "self-care": [
    "self-care",
    "rest",
    "relax",
    "recharge",
    "sleep",
    "boundary",
    "tired",
    "exhausted",
    "drained",
    "burned out",
    "burnt out",
    "not feeling well",
    "unwell",
    "sick",
  ],
  relationships: ["friend", "family", "partner", "relationship", "connection"],
  work: ["work", "job", "career", "meeting", "project", "deadline"],
  growth: ["grow", "improve", "better", "progress", "change", "overcome"],
  morning: ["morning", "woke up", "sunrise", "breakfast", "early"],
  evening: ["evening", "night", "sunset", "dinner", "bedtime", "tonight"],
  anger: ["angry", "furious", "frustrated", "annoyed", "irritated", "mad"],
};
const positiveMoodTags = new Set(["gratitude", "happiness", "mindfulness", "growth"]);
const negativeCueExpressions = [
  /\bnot\s+(?:that\s+)?(grateful|thankful|happy|excited|calm|good|great|well)\b/gi,
  /\b(?:no|never)\s+(gratitude|joy|energy|motivation|hope)\b/gi,
  /\btoo\s+(tired|drained|exhausted)\b/gi,
  /\b(?:don't|do not|didn't|did not|can't|cannot|couldn't|could not)\s+feel\s+(good|well|calm|happy)\b/gi,
];
const moodBoosts: Record<MoodKey, string[]> = {
  amazing: [],
  good: [],
  okay: [],
  bad: ["sadness", "self-care"],
  terrible: ["sadness", "anxiety", "self-care"],
};

const moods: MoodOption[] = [
  { value: "amazing", icon: Heart, label: "Amazing" },
  { value: "good", icon: SmilePlus, label: "Good" },
  { value: "okay", icon: Smile, label: "Okay" },
  { value: "bad", icon: Meh, label: "Bad" },
  { value: "terrible", icon: Frown, label: "Terrible" },
];
const UNTITLED_ENTRY_TITLE = "Untitled";

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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreKeywordMatches(content: string, keyword: string) {
  const expression = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "gi");
  const matches = [...content.matchAll(expression)];
  let positiveMatches = 0;
  let negatedMatches = 0;

  for (const match of matches) {
    const startIndex = match.index ?? 0;
    const contextWindow = content.slice(Math.max(0, startIndex - 18), startIndex);
    const negatedContext =
      /\b(?:not|no|never|hardly|barely)\s+$/.test(contextWindow) ||
      /\bnot\s+that\s+$/.test(contextWindow);

    if (negatedContext) {
      negatedMatches += 1;
      continue;
    }

    positiveMatches += 1;
  }

  return { positiveMatches, negatedMatches };
}

function countNegativeCues(content: string) {
  return negativeCueExpressions.reduce((total, expression) => {
    const matches = content.match(expression);
    return total + (matches?.length || 0);
  }, 0);
}

function analyzeContentForTags(text: string, mood?: MoodKey | null): string[] {
  const lowerText = text.toLowerCase();
  const negativeCueCount = countNegativeCues(lowerText);

  const scored = Object.entries(tagKeywords)
    .map(([tag, keywords]) => {
      const score = keywords.reduce((total, keyword) => {
        const { positiveMatches, negatedMatches } = scoreKeywordMatches(
          lowerText,
          keyword
        );

        return total + positiveMatches - negatedMatches;
      }, 0);

      let nextScore = score;

      if (positiveMoodTags.has(tag) && negativeCueCount > 0) {
        nextScore -= negativeCueCount;
      }

      if (mood && moodBoosts[mood].includes(tag)) {
        nextScore += 1;
      }

      return { tag, score: nextScore };
    })
    .filter(item => item.score > 0);

  const ranked = scored
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.tag.localeCompare(b.tag);
    })
    .slice(0, 5)
    .map(item => item.tag);

  if (ranked.length > 0) {
    return ranked;
  }

  if (lowerText.trim().length >= 40) {
    return ["reflection"];
  }

  return [];
}

function HeaderIconButton({
  icon,
  onPress,
  label,
  borderColor,
  backgroundColor,
  iconColor,
}: {
  icon: typeof Search;
  onPress: () => void;
  label: string;
  borderColor: string;
  backgroundColor: string;
  iconColor: string;
}) {
  const Icon = icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerIconButton,
        {
          borderColor,
          backgroundColor,
        },
        pressed && styles.pressed,
      ]}
    >
      <Icon color={iconColor} size={18} />
    </Pressable>
  );
}

export default function NewEntryScreen({
  onBack,
  initialPrompt,
}: NewEntryScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const addRecentJournalEntry = useAppStore(
    state => state.addRecentJournalEntry
  );
  const setActiveTab = useAppStore(state => state.setActiveTab);
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement
  );
  const isPremiumUser = useAppStore(state => Boolean(state.session?.user.isPremium));
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [writingPrompts, setWritingPrompts] =
    useState<WritingPrompt[]>(DEFAULT_WRITING_PROMPTS);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoTagging, setIsAutoTagging] = useState(false);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [promptsError, setPromptsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const promptListProgress = useRef(new Animated.Value(0)).current;
  const suggestionCardProgress = useRef(new Animated.Value(0)).current;

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 20;
  const sheetMaxWidth = isWide ? 460 : 420;

  useEffect(() => {
    if (!showPrompts) {
      promptListProgress.setValue(0);
      return;
    }

    Animated.timing(promptListProgress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [promptListProgress, showPrompts]);

  useEffect(() => {
    if (suggestedTags.length === 0) {
      suggestionCardProgress.setValue(0);
      return;
    }

    suggestionCardProgress.setValue(0);
    Animated.spring(suggestionCardProgress, {
      toValue: 1,
      speed: 16,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [suggestedTags.length, suggestionCardProgress]);

  useEffect(() => {
    if (!initialPrompt?.trim()) {
      return;
    }

    setSelectedPrompt(previous => previous || initialPrompt.trim());
    setContent(previous => {
      if (previous.includes(initialPrompt.trim())) {
        return previous;
      }

      if (!previous.trim()) {
        return `${initialPrompt.trim()}\n`;
      }

      return `${initialPrompt.trim()}\n\n${previous.trimStart()}`;
    });
  }, [initialPrompt]);

  const maybeSkipTodaysReminder = async () => {
    try {
      const reminder = await getPrimaryDailyReminder();

      if (!reminder?.enabled || !reminder.skipIfCompletedToday) {
        return;
      }

      await syncReminderNotifications(reminder, {
        skipToday: true,
      });
    } catch (reminderError) {
      if (__DEV__) {
        console.log("[NewEntryScreen] Reminder sync skipped", reminderError);
      }
    }
  };

  const moodTone = (mood: MoodKey) => {
    if (mood === "amazing") {
      return {
        color: theme.colors.primary,
        backgroundColor: toRgba(theme.colors.primary, 0.1),
        selectedBackgroundColor: toRgba(theme.colors.primary, 0.14),
      };
    }

    if (mood === "good") {
      return {
        color: theme.colors.success,
        backgroundColor: toRgba(theme.colors.success, 0.1),
        selectedBackgroundColor: toRgba(theme.colors.success, 0.14),
      };
    }

    if (mood === "okay") {
      return {
        color: theme.colors.warning,
        backgroundColor: toRgba(theme.colors.warning, 0.1),
        selectedBackgroundColor: toRgba(theme.colors.warning, 0.14),
      };
    }

    if (mood === "bad") {
      return {
        color: theme.colors.mutedForeground,
        backgroundColor: toRgba(theme.colors.mutedForeground, 0.1),
        selectedBackgroundColor: toRgba(theme.colors.mutedForeground, 0.14),
      };
    }

    return {
      color: theme.colors.destructive,
      backgroundColor: toRgba(theme.colors.destructive, 0.1),
      selectedBackgroundColor: toRgba(theme.colors.destructive, 0.14),
    };
  };

  const handleSave = async () => {
    const trimmedContent = content.trim();

    if (__DEV__) {
      console.log("[NewEntryScreen] Save button pressed", {
        title: title.trim(),
        contentLength: trimmedContent.length,
        selectedMood,
        selectedTags,
      });
    }

    if (!trimmedContent) {
      if (__DEV__) {
        console.log("[NewEntryScreen] Save blocked", {
          reason: "empty-content",
        });
      }
      setError("Please write something before saving.");
      return;
    }

    setIsSaving(true);
    setError(null);

    if (__DEV__) {
      console.log("[NewEntryScreen] Saving state set", {
        isSaving: true,
      });
    }

    const optimisticTags = selectedMood
      ? [...selectedTags, `mood:${selectedMood}`]
      : selectedTags;

    const optimisticEntry = {
      _id: `entry-${Date.now()}`,
      title: title.trim() || UNTITLED_ENTRY_TITLE,
      content: trimmedContent,
      type: "journal",
      aiPrompt: selectedPrompt,
      images: [],
      tags: optimisticTags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (__DEV__) {
        console.log("[NewEntryScreen] Calling createJournalEntry", {
          title: optimisticEntry.title,
          contentLength: optimisticEntry.content.length,
          type: optimisticEntry.type,
          tags: optimisticEntry.tags,
        });
      }

      const savedEntry = await createJournalEntry({
        title: optimisticEntry.title,
        content: optimisticEntry.content,
        type: optimisticEntry.type,
        aiPrompt: optimisticEntry.aiPrompt || undefined,
        tags: optimisticEntry.tags,
      });

      if (__DEV__) {
        console.log("[NewEntryScreen] createJournalEntry resolved", {
          journalId: savedEntry._id,
          title: savedEntry.title,
          type: savedEntry.type,
          tags: savedEntry.tags,
        });
      }

      addRecentJournalEntry(savedEntry);
      await maybeSkipTodaysReminder();

      if (__DEV__) {
        console.log("[NewEntryScreen] Recent entry stored locally", {
          journalId: savedEntry._id,
        });
      }

      setActiveTab("home");

      if (__DEV__) {
        console.log("[NewEntryScreen] Active tab set to home");
      }

      onBack();

      if (__DEV__) {
        console.log("[NewEntryScreen] Navigated back after save");
      }
    } catch (saveError) {
      if (__DEV__) {
        console.log("[NewEntryScreen] Save failed", saveError);
      }

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save this entry right now."
      );
    } finally {
      setIsSaving(false);

      if (__DEV__) {
        console.log("[NewEntryScreen] Save flow finished", {
          isSaving: false,
        });
      }
    }
  };

  const handleAddTag = () => {
    const nextTag = tagInput.trim().toLowerCase();

    if (!nextTag || selectedTags.includes(nextTag)) {
      return;
    }

    setSelectedTags(previous => [...previous, nextTag]);
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(previous => previous.filter(current => current !== tag));
  };

  const handlePromptPress = (prompt: string) => {
    setSelectedPrompt(prompt);
    setContent(previous =>
      previous.trim() ? `${previous.trimEnd()}\n\n${prompt}\n` : `${prompt}\n`
    );
    setShowPrompts(false);
  };

  const loadWritingPrompts = async () => {
    setIsLoadingPrompts(true);
    setPromptsError(null);

    try {
      const response = await getWritingPrompts();
      setWritingPrompts(
        response.prompts.length > 0 ? response.prompts : DEFAULT_WRITING_PROMPTS
      );
    } catch (promptError) {
      if (__DEV__) {
        console.log("[NewEntryScreen] Writing prompts request failed", promptError);
      }

      setWritingPrompts(DEFAULT_WRITING_PROMPTS);
      setPromptsError("Unable to load writing prompts right now.");
    } finally {
      setIsLoadingPrompts(false);
    }
  };

  const handleTogglePrompts = () => {
    const nextShowPrompts = !showPrompts;
    setShowPrompts(nextShowPrompts);

    if (nextShowPrompts) {
      loadWritingPrompts().catch(() => undefined);
    }
  };

  const handleAutoTag = async () => {
    if (!isPremiumUser) {
      trackPaywallEvent({
        placementKey: "new_entry_auto_tag_locked",
        screenKey: "new-entry",
        eventType: "locked_feature_tap",
        wasInterruptive: false,
      }).catch(() => undefined);
      openPaywallForPlacement({
        placementKey: "new_entry_auto_tag_locked",
        returnStage: "new-entry",
        screenKey: "new-entry",
      });
      return;
    }

    if (!content.trim()) {
      setError("Write something first so AI can analyze it.");
      return;
    }

    setIsAutoTagging(true);
    setError(null);

    try {
      const response = await fetchSuggestedJournalTags({
        content,
        selectedTags,
        mood: selectedMood,
      });
      const aiTags = response.tags.filter(tag => Boolean(tag?.trim()));
      setSuggestedTags(aiTags);
    } catch (autoTagError) {
      if (__DEV__) {
        console.log("[NewEntryScreen] Auto-tag request failed", autoTagError);
      }

      if (autoTagError instanceof ApiError && autoTagError.status === 403) {
        setSuggestedTags([]);
        setError("Premium membership is required for AI tag suggestions.");
        return;
      }

      const fallbackSuggestions = analyzeContentForTags(content, selectedMood).filter(
        tag => !selectedTags.includes(tag)
      );

      if (fallbackSuggestions.length > 0) {
        setSuggestedTags(fallbackSuggestions);
      } else {
        setError(
          autoTagError instanceof Error
            ? autoTagError.message
            : "Unable to suggest tags right now."
        );
      }
    } finally {
      setIsAutoTagging(false);
    }
  };

  const handleAcceptSuggestedTag = (tag: string) => {
    setSelectedTags(previous =>
      previous.includes(tag) ? previous : [...previous, tag]
    );
    setSuggestedTags(previous => previous.filter(current => current !== tag));
  };

  const handleAcceptAllSuggested = () => {
    setSelectedTags(previous => {
      const merged = new Set([...previous, ...suggestedTags]);
      return Array.from(merged);
    });
    setSuggestedTags([]);
  };

  const handleDismissSuggested = (tag: string) => {
    setSuggestedTags(previous => previous.filter(current => current !== tag));
  };

  const promptListAnimatedStyle = {
    opacity: promptListProgress,
    transform: [
      {
        translateY: promptListProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [-10, 0],
        }),
      },
      {
        scale: promptListProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.98, 1],
        }),
      },
    ],
  } as const;

  const suggestionCardAnimatedStyle = {
    opacity: suggestionCardProgress,
    transform: [
      {
        translateY: suggestionCardProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
      {
        scale: suggestionCardProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.98, 1],
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
            <Pressable
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
            </Pressable>

            <Text style={[styles.headerTitle, { color: theme.colors.foreground }]}>
              New Entry
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save entry"
              onPress={handleSave}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
                pressed && !isSaving && styles.pressed,
                isSaving && styles.saveButtonSaving,
              ]}
            >
              {isSaving ? (
                <Loader2 size={14} color={theme.colors.primary} />
              ) : (
                <Save size={14} color={theme.colors.primary} />
              )}
              <Text
                style={[styles.saveButtonText, { color: theme.colors.primary }]}
              >
                {isSaving ? "Saving..." : "Save"}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.content,
              styles.contentInset,
              {
                paddingHorizontal: horizontalPadding,
                backgroundColor: theme.colors.background,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.sheet, { maxWidth: sheetMaxWidth }]}>
              <View style={styles.section}>
                <Text
                  style={[styles.sectionLabel, { color: theme.colors.foreground }]}
                >
                  How are you feeling?
                </Text>
                <View style={styles.moodRow}>
                  {moods.map(mood => {
                    const Icon = mood.icon;
                    const isSelected = selectedMood === mood.value;
                    const tone = moodTone(mood.value);

                    return (
                      <Pressable
                        key={mood.value}
                        accessibilityRole="button"
                        accessibilityLabel={mood.label}
                        onPress={() => setSelectedMood(mood.value)}
                        style={({ pressed }) => [
                          styles.moodButton,
                          {
                            borderColor: isSelected
                              ? theme.colors.primary
                              : theme.colors.border,
                            backgroundColor: isSelected
                              ? tone.selectedBackgroundColor
                              : tone.backgroundColor,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Icon
                          size={24}
                          color={isSelected ? tone.color : theme.colors.mutedForeground}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <TextInput
                  accessibilityLabel="Entry title"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Give your entry a title (optional)"
                  placeholderTextColor={theme.colors.mutedForeground}
                  autoCapitalize="sentences"
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPrompts ? "Hide writing prompts" : "Show writing prompts"}
                  onPress={handleTogglePrompts}
                  style={({ pressed }) => [
                    styles.promptToggle,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.card,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Sparkles size={16} color={theme.colors.primary} />
                  <Text
                    style={[styles.promptToggleText, { color: theme.colors.foreground }]}
                  >
                    {showPrompts ? "Hide Writing Prompts" : "Show Writing Prompts"}
                  </Text>
                </Pressable>

                {showPrompts ? (
                  <Animated.View style={[styles.promptList, promptListAnimatedStyle]}>
                    {isLoadingPrompts ? (
                      <View
                        style={[
                          styles.promptStatusCard,
                          {
                            backgroundColor: theme.colors.accent,
                            borderColor: theme.colors.border,
                          },
                        ]}
                      >
                        <Loader2 size={16} color={theme.colors.primary} />
                        <Text
                          style={[
                            styles.promptStatusText,
                            { color: theme.colors.mutedForeground },
                          ]}
                        >
                          Loading personalized prompts...
                        </Text>
                      </View>
                    ) : (
                      writingPrompts.map(prompt => (
                        <Pressable
                          key={prompt.id}
                          accessibilityRole="button"
                          accessibilityLabel={prompt.text}
                          onPress={() => handlePromptPress(prompt.text)}
                          style={({ pressed }) => [
                            styles.promptButton,
                            {
                              backgroundColor: theme.colors.accent,
                              borderColor: theme.colors.border,
                            },
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.promptButtonTopic,
                              { color: theme.colors.primary },
                            ]}
                          >
                            {prompt.topic}
                          </Text>
                          <Text
                            style={[
                              styles.promptButtonText,
                              { color: theme.colors.foreground },
                            ]}
                          >
                            {prompt.text}
                          </Text>
                        </Pressable>
                      ))
                    )}
                    {promptsError ? (
                      <Text
                        style={[
                          styles.promptErrorText,
                          { color: theme.colors.mutedForeground },
                        ]}
                      >
                        {promptsError}
                      </Text>
                    ) : null}
                  </Animated.View>
                ) : null}
              </View>

              <View style={styles.section}>
                <TextInput
                  accessibilityLabel="Entry content"
                  value={content}
                  onChangeText={setContent}
                  placeholder="Start writing your thoughts..."
                  placeholderTextColor={theme.colors.mutedForeground}
                  multiline
                  autoFocus
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

              <View style={styles.toolbarRow}>
                <HeaderIconButton
                  icon={Mic}
                  label="Voice note"
                  onPress={() => {}}
                  borderColor={theme.colors.border}
                  backgroundColor={theme.colors.card}
                  iconColor={theme.colors.foreground}
                />
                <HeaderIconButton
                  icon={ImageIcon}
                  label="Add image"
                  onPress={() => {}}
                  borderColor={theme.colors.border}
                  backgroundColor={theme.colors.card}
                  iconColor={theme.colors.foreground}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Auto-tag with AI"
                onPress={handleAutoTag}
                disabled={isAutoTagging}
                style={({ pressed }) => [
                  styles.autoTagCard,
                  {
                    borderColor: isPremiumUser
                      ? theme.colors.primary
                      : theme.colors.border,
                    backgroundColor: isPremiumUser
                      ? toRgba(theme.colors.primary, 0.05)
                      : theme.colors.card,
                  },
                  pressed && !isAutoTagging && styles.pressed,
                  (isAutoTagging || !isPremiumUser) && styles.autoTagCardDisabled,
                ]}
              >
                <View
                  style={[
                    styles.autoTagIconWrap,
                    {
                      backgroundColor: isPremiumUser
                        ? toRgba(theme.colors.primary, 0.1)
                        : theme.colors.accent,
                    },
                  ]}
                >
                  {isAutoTagging ? (
                    <Loader2 size={18} color={theme.colors.primary} />
                  ) : !isPremiumUser ? (
                    <Lock size={18} color={theme.colors.mutedForeground} />
                  ) : (
                    <Wand2 size={18} color={theme.colors.primary} />
                  )}
                </View>
                <View style={styles.autoTagCopy}>
                  <Text
                    style={[styles.autoTagTitle, { color: theme.colors.foreground }]}
                  >
                    Auto-tag with AI
                  </Text>
                  <Text
                    style={[
                      styles.autoTagSubtitle,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    {isPremiumUser
                      ? "Analyze your thoughts and suggest tags"
                      : "Premium unlocks AI tag suggestions for your entries"}
                  </Text>
                </View>
                {isPremiumUser ? (
                  <Sparkles size={16} color={theme.colors.primary} />
                ) : (
                  <Text
                    style={[
                      styles.autoTagSubtitle,
                      styles.autoTagPremiumText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    Premium
                  </Text>
                )}
              </Pressable>

              <View style={styles.section}>
                <Text
                  style={[styles.sectionLabel, { color: theme.colors.foreground }]}
                >
                  Tags
                </Text>
                <View style={styles.tagInputRow}>
                  <TextInput
                    accessibilityLabel="Add tag"
                    value={tagInput}
                    onChangeText={setTagInput}
                    placeholder="Add a tag..."
                    placeholderTextColor={theme.colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleAddTag}
                    style={[
                      styles.tagInput,
                      {
                        color: theme.colors.foreground,
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.card,
                      },
                    ]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add tag"
                    onPress={handleAddTag}
                    style={({ pressed }) => [
                      styles.addTagButton,
                      {
                        backgroundColor: theme.colors.primary,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Tag size={16} color={theme.colors.primaryForeground} />
                  </Pressable>
                </View>

                {selectedTags.length > 0 ? (
                  <View style={styles.tagWrap}>
                    {selectedTags.map(tag => (
                      <View
                        key={tag}
                        style={[
                          styles.tagPill,
                          {
                            backgroundColor: theme.colors.secondary,
                            borderColor: theme.colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.tagText, { color: theme.colors.foreground }]}
                        >
                          {tag}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${tag}`}
                          onPress={() => handleRemoveTag(tag)}
                          style={styles.tagRemoveButton}
                        >
                          <X size={12} color={theme.colors.mutedForeground} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                {suggestedTags.length > 0 ? (
                  <Animated.View
                    style={[
                      styles.suggestionCard,
                      suggestionCardAnimatedStyle,
                      {
                        borderColor: theme.colors.primary,
                        backgroundColor: toRgba(theme.colors.primary, 0.05),
                      },
                    ]}
                  >
                    <View style={styles.suggestionHeader}>
                      <View style={styles.suggestionHeaderLeft}>
                        <Wand2 size={14} color={theme.colors.primary} />
                        <Text
                          style={[
                            styles.suggestionKicker,
                            { color: theme.colors.primary },
                          ]}
                        >
                          AI Suggested Tags
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Add all suggested tags"
                        onPress={handleAcceptAllSuggested}
                      >
                        <Text
                          style={[
                            styles.suggestionAction,
                            { color: theme.colors.primary },
                          ]}
                        >
                          Add all
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.tagWrap}>
                      {suggestedTags.map(tag => (
                        <View
                          key={tag}
                          style={[
                            styles.suggestionPill,
                            {
                              borderColor: theme.colors.primary,
                              backgroundColor: toRgba(theme.colors.primary, 0.1),
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.suggestionText,
                              { color: theme.colors.primary },
                            ]}
                          >
                            {tag}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Add ${tag}`}
                            onPress={() => handleAcceptSuggestedTag(tag)}
                            style={styles.suggestionIconButton}
                          >
                            <Check size={12} color={theme.colors.primary} />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Dismiss ${tag}`}
                            onPress={() => handleDismissSuggested(tag)}
                            style={styles.suggestionIconButton}
                          >
                            <X size={12} color={theme.colors.mutedForeground} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </Animated.View>
                ) : null}
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
        </View>
      </KeyboardAvoidingView>
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
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  saveButton: {
    minWidth: 76,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexShrink: 0,
  },
  saveButtonSaving: {
    opacity: 0.8,
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    flexGrow: 1,
    paddingTop: 4,
  },
  contentInset: {
    paddingBottom: 24,
  },
  sheet: {
    width: "100%",
    alignSelf: "center",
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  moodRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  moodButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  titleInput: {
    borderBottomWidth: 1,
    fontSize: 18,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  promptToggle: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  promptToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  promptList: {
    marginTop: 10,
    gap: 8,
  },
  promptStatusCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  promptStatusText: {
    fontSize: 13,
    lineHeight: 18,
  },
  promptButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  promptButtonTopic: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  promptButtonText: {
    fontSize: 13,
    lineHeight: 18,
  },
  promptErrorText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
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
  toolbarRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  autoTagCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  autoTagCardDisabled: {
    opacity: 0.7,
  },
  autoTagIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  autoTagCopy: {
    flex: 1,
    minWidth: 0,
  },
  autoTagTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  autoTagSubtitle: {
    fontSize: 11,
    lineHeight: 16,
  },
  autoTagPremiumText: {
    fontWeight: "700",
  },
  tagInputRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  addTagButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  tagRemoveButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  suggestionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  suggestionKicker: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  suggestionAction: {
    fontSize: 11,
    fontWeight: "600",
  },
  suggestionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  suggestionIconButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  successCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  successCopy: {
    flex: 1,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  successSubtitle: {
    fontSize: 12,
    lineHeight: 18,
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
