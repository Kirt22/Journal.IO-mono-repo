import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  Bell,
  Brain,
  CalendarDays,
  Check,
  ChevronRight,
  Feather,
  Hash,
  Heart,
  Lightbulb,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Sun,
  X,
  BookOpen,
  Frown,
  Meh,
  Smile,
  SmilePlus,
  RotateCcw,
} from "lucide-react-native";
import TabScreenLayout from "../components/TabScreenLayout";
import { useTheme } from "../theme/provider";

type HomeScreenProps = {
  userName?: string;
  onOpenNewEntry: () => void;
  onToggleTheme: (nextMode: "light" | "dark") => void;
};

type MoodType = "amazing" | "good" | "okay" | "bad" | "terrible";

const aiPrompts = [
  "What are you grateful for today?",
  "What challenged you recently and what did you learn?",
  "Describe a moment that made you smile",
  "What would you tell your past self?",
];

const quickTags = ["thought", "idea", "reminder", "gratitude", "dream"];

const moods: {
  value: MoodType;
  icon: typeof Smile;
  label: string;
  emoji: string;
}[] = [
  {
    value: "amazing",
    icon: Heart,
    label: "Amazing",
    emoji: "🤩",
  },
  {
    value: "good",
    icon: SmilePlus,
    label: "Good",
    emoji: "😊",
  },
  {
    value: "okay",
    icon: Smile,
    label: "Okay",
    emoji: "😌",
  },
  {
    value: "bad",
    icon: Meh,
    label: "Bad",
    emoji: "😔",
  },
  {
    value: "terrible",
    icon: Frown,
    label: "Terrible",
    emoji: "😢",
  },
];

const tips = [
  "Try writing for just 3 minutes today — short entries still build clarity over time.",
  "Name your emotions specifically. \"Frustrated\" is more useful than \"bad\".",
  "Re-reading past entries can reveal growth you don’t notice day-to-day.",
  "Morning journaling sets intention. Evening journaling brings closure.",
  "Writing about challenges helps your brain process them more effectively.",
];

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

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

function ActionTile({
  icon,
  label,
  onPress,
  accessibilityLabel,
  iconColor,
  labelColor,
  borderColor,
  backgroundColor,
}: {
  icon: typeof Plus;
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  iconColor: string;
  labelColor: string;
  borderColor: string;
  backgroundColor: string;
}) {
  const Icon = icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        {
          borderColor,
          backgroundColor,
        },
        pressed && styles.pressed,
      ]}
    >
      <Icon color={iconColor} size={20} />
      <Text style={[styles.actionLabel, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({
  theme,
  title,
  description,
  actionLabel,
  onActionPress,
  actionAccessibilityLabel,
}: {
  theme: ReturnType<typeof useTheme>;
  title: string;
  description: string;
  actionLabel?: string;
  onActionPress?: () => void;
  actionAccessibilityLabel?: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyStateIconWrap,
          {
            backgroundColor: theme.colors.accent,
          },
        ]}
      >
        <BookOpen color={theme.colors.mutedForeground} size={28} />
      </View>
      <Text style={[styles.emptyStateTitle, { color: theme.colors.foreground }]}>
        {title}
      </Text>
      <Text
        style={[
          styles.emptyStateDescription,
          { color: theme.colors.mutedForeground },
        ]}
      >
        {description}
      </Text>
      {actionLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel}
          onPress={onActionPress}
          style={({ pressed }) => [
            styles.emptyStateAction,
            {
              backgroundColor: theme.colors.primary,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.emptyStateActionText,
              { color: theme.colors.primaryForeground },
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function RevealBlock({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={style}>{children}</View>;
}

export default function HomeScreen({
  userName,
  onOpenNewEntry,
  onToggleTheme,
}: HomeScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const noteInputRef = useRef<TextInput>(null);
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [savedMood, setSavedMood] = useState<MoodType | null>(null);
  const [note, setNote] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const [noteInputHeight, setNoteInputHeight] = useState(92);
  const [insightIndex, setInsightIndex] = useState(
    new Date().getDate() % tips.length
  );

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 20;
  const layoutMaxWidth = isWide ? 460 : 420;
  const titleSize = isCompact ? 26 : isWide ? 34 : 30;
  const sectionTitleSize = isCompact ? 17 : 18;
  const firstName = useMemo(() => {
    const trimmedName = userName?.trim();

    if (!trimmedName) {
      return "there";
    }

    return trimmedName.split(/\s+/)[0];
  }, [userName]);

  const greeting = getGreeting();
  const todayPrompt = aiPrompts[new Date().getDate() % aiPrompts.length];
  const displayedMood = selectedMood || savedMood;
  const todayDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "2-digit",
      }).format(new Date()),
    []
  );

  useEffect(() => {
    if (isNoteExpanded) {
      noteInputRef.current?.focus();
    }
  }, [isNoteExpanded]);

  useEffect(() => {
    if (!isNoteExpanded) {
      setNoteInputHeight(92);
    }
  }, [isNoteExpanded]);

  const handleSelectMood = async (mood: MoodType) => {
    setSelectedMood(mood);

    await new Promise<void>(resolve => setTimeout(resolve, 300));

    setSavedMood(mood);
    setSelectedMood(null);
  };

  const handleResetMood = () => {
    setSelectedMood(null);
    setSavedMood(null);
  };

  const handleSaveNote = () => {
    if (!note.trim()) {
      return;
    }

    setNote("");
    setSelectedTags([]);
    setIsNoteExpanded(false);
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags(previous =>
      previous.includes(tag)
        ? previous.filter(currentTag => currentTag !== tag)
        : [...previous, tag]
    );
  };

  const moodData = displayedMood
    ? moods.find(mood => mood.value === displayedMood)
    : null;

  const currentMoodTone =
    displayedMood === "amazing"
      ? {
          color: theme.colors.primary,
          backgroundColor: hexToRgba(theme.colors.primary, 0.1),
        }
      : displayedMood === "good"
        ? {
            color: theme.colors.success,
            backgroundColor: hexToRgba(theme.colors.success, 0.1),
          }
        : displayedMood === "okay"
          ? {
              color: theme.colors.warning,
              backgroundColor: hexToRgba(theme.colors.warning, 0.12),
            }
          : displayedMood === "bad"
            ? {
                color: theme.colors.mutedForeground,
                backgroundColor: hexToRgba(theme.colors.mutedForeground, 0.12),
              }
            : displayedMood === "terrible"
              ? {
                  color: theme.colors.destructive,
                  backgroundColor: hexToRgba(theme.colors.destructive, 0.1),
              }
              : null;

  const activeInsightDotStyle = {
    backgroundColor: theme.colors.primary,
  };
  const inactiveInsightDotStyle = {
    backgroundColor: theme.colors.border,
  };

  const noteBorderColor = isNoteExpanded
    ? theme.colors.primary
    : theme.colors.border;

  return (
    <TabScreenLayout
      backgroundColor={theme.colors.background}
      horizontalPadding={horizontalPadding}
      layoutMaxWidth={layoutMaxWidth}
      shellStyle={styles.content}
    >
      <RevealBlock style={styles.header}>
        <View style={styles.headerCopy}>
          <Text
            style={[
              styles.greeting,
              { color: theme.colors.mutedForeground },
            ]}
          >
            {greeting}
          </Text>
          <Text
            style={[
              styles.title,
              { color: theme.colors.foreground, fontSize: titleSize },
            ]}
          >
            {firstName} <Text style={styles.wave}>👋</Text>
          </Text>
          <Text
            style={[
              styles.date,
              { color: theme.colors.mutedForeground },
            ]}
          >
            {todayDate}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <HeaderIconButton
            icon={theme.mode === "dark" ? Sun : Moon}
            onPress={() => onToggleTheme(theme.mode === "dark" ? "light" : "dark")}
            label="Toggle theme"
            borderColor={theme.colors.border}
            backgroundColor={theme.colors.card}
            iconColor={theme.colors.foreground}
          />
          <HeaderIconButton
            icon={Search}
            onPress={() => {}}
            label="Search"
            borderColor={theme.colors.border}
            backgroundColor={theme.colors.card}
            iconColor={theme.colors.foreground}
          />
          <HeaderIconButton
            icon={Bell}
            onPress={() => {}}
            label="Reminders"
            borderColor={theme.colors.border}
            backgroundColor={theme.colors.card}
            iconColor={theme.colors.foreground}
          />
        </View>
      </RevealBlock>

      <RevealBlock style={[
          styles.streakCard,
          {
            borderColor: theme.colors.primary,
            backgroundColor: hexToRgba(theme.colors.primary, 0.08),
          },
        ]}>
        <View style={styles.streakCopy}>
          <Text
            style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}
          >
            Current Streak
          </Text>
          <View style={styles.streakValueRow}>
            <Text
              style={[styles.streakValue, { color: theme.colors.foreground }]}
            >
              0
            </Text>
            <Text
              style={[
                styles.streakSuffix,
                { color: theme.colors.mutedForeground },
              ]}
            >
              days
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {}}
          style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
        >
          <Text style={[styles.ghostButtonText, { color: theme.colors.foreground }]}>
            View Details
          </Text>
        </Pressable>
      </RevealBlock>

          <View style={styles.sectionSpacing}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {displayedMood && moodData && currentMoodTone ? (
                <View style={styles.moodSavedRow}>
                  <View
                    style={[
                      styles.moodSavedIcon,
                      { backgroundColor: currentMoodTone.backgroundColor },
                    ]}
                  >
                    <Text style={styles.moodEmoji}>{moodData.emoji}</Text>
                  </View>
                  <View style={styles.moodSavedCopy}>
                    <View style={styles.moodSavedTitleRow}>
                      <Text
                        style={[
                          styles.moodSavedTitle,
                          { color: theme.colors.foreground },
                        ]}
                      >
                        Feeling{" "}
                        <Text style={{ color: currentMoodTone.color }}>
                          {moodData.label.toLowerCase()}
                        </Text>{" "}
                        today
                      </Text>
                      <Check size={14} color={theme.colors.success} />
                    </View>
                    <Text
                      style={[
                        styles.moodSavedSubtitle,
                        { color: theme.colors.mutedForeground },
                      ]}
                    >
                      Mood logged for today
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Change mood"
                    onPress={handleResetMood}
                    style={({ pressed }) => [
                      styles.smallIconButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <RotateCcw size={14} color={theme.colors.mutedForeground} />
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text
                    style={[
                      styles.cardPrompt,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    How are you feeling right now?
                  </Text>

                  <View style={styles.moodRow}>
                    {moods.map(mood => {
                      const Icon = mood.icon;
                      const isSelected = selectedMood === mood.value;

                      const tone =
                        mood.value === "amazing"
                          ? {
                              color: theme.colors.primary,
                              backgroundColor: hexToRgba(theme.colors.primary, 0.1),
                              selectedBackgroundColor: hexToRgba(
                                theme.colors.primary,
                                0.14
                              ),
                            }
                          : mood.value === "good"
                            ? {
                                color: theme.colors.success,
                                backgroundColor: hexToRgba(theme.colors.success, 0.1),
                                selectedBackgroundColor: hexToRgba(
                                  theme.colors.success,
                                  0.14
                                ),
                              }
                            : mood.value === "okay"
                              ? {
                                  color: theme.colors.warning,
                                  backgroundColor: hexToRgba(theme.colors.warning, 0.1),
                                  selectedBackgroundColor: hexToRgba(
                                    theme.colors.warning,
                                    0.14
                                  ),
                                }
                              : mood.value === "bad"
                                ? {
                                    color: theme.colors.mutedForeground,
                                    backgroundColor: hexToRgba(
                                      theme.colors.mutedForeground,
                                      0.1
                                    ),
                                    selectedBackgroundColor: hexToRgba(
                                      theme.colors.mutedForeground,
                                      0.14
                                    ),
                                  }
                                : {
                                    color: theme.colors.destructive,
                                    backgroundColor: hexToRgba(
                                      theme.colors.destructive,
                                      0.1
                                    ),
                                    selectedBackgroundColor: hexToRgba(
                                      theme.colors.destructive,
                                      0.14
                                    ),
                                  };

                      return (
                        <Pressable
                          key={mood.value}
                          accessibilityRole="button"
                          accessibilityLabel={mood.label}
                          onPress={() => {
                            handleSelectMood(mood.value).catch(() => {});
                          }}
                          style={({ pressed }) => [
                            styles.moodOption,
                            isSelected && {
                              backgroundColor: tone.selectedBackgroundColor,
                            },
                            !isSelected && {
                              backgroundColor: tone.backgroundColor,
                            },
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={[styles.moodIconCircle, { backgroundColor: isSelected ? tone.selectedBackgroundColor : theme.colors.secondary }]}>
                            <Icon
                              size={18}
                              color={isSelected ? tone.color : theme.colors.mutedForeground}
                            />
                          </View>
                          <Text
                            style={[
                              styles.moodLabel,
                              {
                                color: isSelected
                                  ? tone.color
                                  : theme.colors.mutedForeground,
                              },
                            ]}
                          >
                            {mood.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={styles.sectionSpacing}>
            <View
              style={[
                styles.card,
                styles.quickNoteCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: noteBorderColor,
                },
              ]}
            >
              {!isNoteExpanded ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIsNoteExpanded(true)}
                  style={({ pressed }) => [
                    styles.quickNoteCollapsed,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.quickNoteIcon,
                      {
                        backgroundColor: hexToRgba(theme.colors.primary, 0.1),
                      },
                    ]}
                  >
                    <Feather size={18} color={theme.colors.primary} />
                  </View>
                  <Text
                    style={[
                      styles.quickNotePlaceholder,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    Capture a quick thought...
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.quickNoteExpanded}>
                  <View style={styles.quickNoteHeader}>
                    <View style={styles.quickNoteTitleRow}>
                      <Feather size={16} color={theme.colors.primary} />
                      <Text
                        style={[
                          styles.quickNoteTitle,
                          { color: theme.colors.foreground },
                        ]}
                      >
                        Quick Note
                      </Text>
                    </View>
                    <View style={styles.quickNoteActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Expand to full editor"
                        onPress={() => {}}
                        style={({ pressed }) => [
                          styles.smallIconButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <ChevronRight size={14} color={theme.colors.mutedForeground} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Close"
                        onPress={() => {
                          setIsNoteExpanded(false);
                          setNote("");
                          setSelectedTags([]);
                        }}
                        style={({ pressed }) => [
                          styles.smallIconButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <X size={14} color={theme.colors.mutedForeground} />
                      </Pressable>
                    </View>
                  </View>

                  <TextInput
                    ref={noteInputRef}
                    value={note}
                    onChangeText={setNote}
                    onContentSizeChange={event => {
                      const nextHeight = Math.min(
                        120,
                        Math.max(72, event.nativeEvent.contentSize.height)
                      );

                      setNoteInputHeight(nextHeight);
                    }}
                    placeholder="What's on your mind?"
                    placeholderTextColor={theme.colors.mutedForeground}
                    multiline
                    scrollEnabled={false}
                    maxLength={500}
                    style={[
                      styles.quickNoteInput,
                      {
                        color: theme.colors.foreground,
                        height: noteInputHeight,
                      },
                    ]}
                  />

                  <View style={styles.quickTagsRow}>
                    <Hash size={12} color={theme.colors.mutedForeground} />
                    {quickTags.map(tag => {
                      const selected = selectedTags.includes(tag);

                      return (
                        <Pressable
                          key={tag}
                          accessibilityRole="button"
                          accessibilityLabel={tag}
                          onPress={() => handleToggleTag(tag)}
                          style={({ pressed }) => [
                            styles.tagChip,
                            {
                              borderColor: selected
                                ? theme.colors.primary
                                : theme.colors.border,
                              backgroundColor: selected
                                ? hexToRgba(theme.colors.primary, 0.1)
                                : theme.colors.card,
                            },
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.tagText,
                              {
                                color: selected
                                  ? theme.colors.primary
                                  : theme.colors.mutedForeground,
                              },
                            ]}
                          >
                            {tag}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.quickNoteFooter}>
                    <Text
                      style={[
                        styles.quickNoteCount,
                        { color: theme.colors.mutedForeground },
                      ]}
                    >
                      {note.length}/500
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleSaveNote}
                      disabled={!note.trim()}
                      style={({ pressed }) => [
                        styles.saveButton,
                        {
                          backgroundColor: theme.colors.primary,
                        },
                        !note.trim() && styles.saveButtonDisabled,
                        pressed && note.trim() && styles.pressed,
                      ]}
                    >
                      <Send size={12} color={theme.colors.primaryForeground} />
                      <Text
                        style={[
                          styles.saveButtonText,
                          { color: theme.colors.primaryForeground },
                        ]}
                      >
                        Save
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>

          <View style={styles.sectionSpacing}>
            <View
              style={[
                styles.card,
                styles.insightCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.insightGlow,
                  { backgroundColor: hexToRgba(theme.colors.primary, 0.08) },
                ]}
              />
              <View style={styles.insightHeader}>
                <View style={styles.insightTitleRow}>
                  <Brain size={14} color={theme.colors.primary} />
                  <Text
                    style={[
                      styles.sectionKicker,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    AI Insight
                  </Text>
                </View>

                <View style={styles.insightControls}>
                  <View style={styles.insightDots}>
                    {tips.map((_, _index) => (
                      <Pressable
                        key={_index}
                        accessibilityRole="button"
                        accessibilityLabel={`Insight ${_index + 1}`}
                        onPress={() => setInsightIndex(_index)}
                        style={[
                          styles.insightDot,
                          _index === insightIndex
                            ? activeInsightDotStyle
                            : inactiveInsightDotStyle,
                          _index === insightIndex && styles.insightDotActive,
                        ]}
                      />
                    ))}
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Next insight"
                    onPress={() =>
                      setInsightIndex(previous => (previous + 1) % tips.length)
                    }
                    style={({ pressed }) => [
                      styles.smallIconButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <RefreshCw size={13} color={theme.colors.mutedForeground} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.insightBody}>
                <View
                  style={[
                    styles.insightIconWrap,
                    {
                      backgroundColor: hexToRgba(theme.colors.primary, 0.1),
                    },
                  ]}
                >
                  <Lightbulb size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.insightCopy}>
                  <Text
                    style={[
                      styles.insightTitle,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    Daily Tip
                  </Text>
                  <Text
                    style={[
                      styles.insightText,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    {tips[insightIndex]}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionSpacing}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.promptRow}>
                <View
                  style={[
                    styles.promptIconWrap,
                    { backgroundColor: hexToRgba(theme.colors.primary, 0.1) },
                  ]}
                >
                  <Sparkles size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.promptCopy}>
                  <Text
                    style={[
                      styles.sectionKicker,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    Today&apos;s Prompt
                  </Text>
                  <Text
                    style={[
                      styles.promptText,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    {todayPrompt}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionSpacing}>
            <View style={styles.quickActionsGrid}>
              <ActionTile
                icon={Plus}
                label="New Entry"
                accessibilityLabel="Create new entry"
                onPress={onOpenNewEntry}
                iconColor={theme.colors.primary}
                labelColor={theme.colors.mutedForeground}
                borderColor={theme.colors.border}
                backgroundColor={theme.colors.card}
              />
              <ActionTile
                icon={CalendarDays}
                label="Calendar"
                accessibilityLabel="Open calendar"
                onPress={() => {}}
                iconColor={theme.colors.primary}
                labelColor={theme.colors.mutedForeground}
                borderColor={theme.colors.border}
                backgroundColor={theme.colors.card}
              />
              <ActionTile
                icon={Sparkles}
                label="Prompts"
                accessibilityLabel="Open prompts"
                onPress={() => {}}
                iconColor={theme.colors.primary}
                labelColor={theme.colors.mutedForeground}
                borderColor={theme.colors.border}
                backgroundColor={theme.colors.card}
              />
            </View>
          </View>

      <View style={styles.sectionSpacingBottom}>
        <View style={styles.recentHeader}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.colors.foreground,
                fontSize: sectionTitleSize,
              },
            ]}
          >
            Recent Entries
          </Text>
        </View>

        <EmptyState
          theme={theme}
          title="No entries yet"
          description="Start your journaling journey by creating your first entry"
          actionLabel="Create Entry"
          actionAccessibilityLabel="Create a new entry"
          onActionPress={onOpenNewEntry}
        />
          </View>
    </TabScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
    paddingBottom: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  headerCopy: {
    flex: 1,
  },
  greeting: {
    fontSize: 13,
    marginBottom: 4,
  },
  title: {
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  wave: {
    fontSize: 28,
  },
  date: {
    marginTop: 4,
    fontSize: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  streakCard: {
    marginTop: 22,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  streakCopy: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  streakValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  streakValue: {
    fontSize: 32,
    fontWeight: "600",
    letterSpacing: -0.5,
  },
  streakSuffix: {
    fontSize: 14,
  },
  ghostButton: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ghostButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionSpacing: {
    marginTop: 12,
  },
  sectionSpacingBottom: {
    marginTop: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    overflow: "hidden",
  },
  quickNoteCard: {
    padding: 0,
  },
  cardPrompt: {
    fontSize: 15,
    marginBottom: 16,
  },
  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  moodOption: {
    flex: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 8,
  },
  moodIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  moodLabel: {
    fontSize: 11,
  },
  moodSavedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  moodSavedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  moodEmoji: {
    fontSize: 22,
  },
  moodSavedCopy: {
    flex: 1,
  },
  moodSavedTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  moodSavedTitle: {
    fontSize: 14,
    flex: 1,
  },
  moodSavedSubtitle: {
    marginTop: 4,
    fontSize: 12,
  },
  smallIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  quickNoteCollapsed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  quickNoteIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  quickNotePlaceholder: {
    flex: 1,
    fontSize: 14,
  },
  quickNoteExpanded: {
    padding: 16,
  },
  quickNoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  quickNoteTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickNoteTitle: {
    fontSize: 14,
  },
  quickNoteActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  quickNoteInput: {
    fontSize: 14,
    textAlignVertical: "top",
    paddingVertical: 0,
    marginBottom: 12,
  },
  quickTagsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  tagChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 11,
  },
  quickNoteFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  quickNoteCount: {
    fontSize: 12,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  insightCard: {
    padding: 20,
    position: "relative",
  },
  insightGlow: {
    position: "absolute",
    top: -48,
    right: -48,
    width: 128,
    height: 128,
    borderRadius: 64,
    opacity: 1,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
    zIndex: 1,
  },
  insightTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionKicker: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  insightControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  insightDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  insightDot: {
    height: 6,
    width: 6,
    borderRadius: 999,
  },
  insightDotActive: {
    width: 16,
  },
  insightBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    zIndex: 1,
  },
  insightIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  insightCopy: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  insightText: {
    fontSize: 12,
    lineHeight: 18,
  },
  promptRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  promptIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  promptCopy: {
    flex: 1,
  },
  promptText: {
    fontSize: 14,
    lineHeight: 20,
  },
  quickActionsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  actionTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionLabel: {
    fontSize: 11,
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyStateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyStateTitle: {
    fontSize: 16,
    marginBottom: 6,
  },
  emptyStateDescription: {
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 260,
    textAlign: "center",
    marginBottom: 18,
  },
  emptyStateAction: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyStateActionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
});
