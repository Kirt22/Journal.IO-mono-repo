import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "../../infrastructure/reactNative";
import {
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  Heart,
  List,
  Smile,
  Sparkles,
  Star,
  Tag,
} from "lucide-react-native";
import { Animated, Easing, useWindowDimensions } from "react-native";
import TabScreenLayout from "../../components/TabScreenLayout";
import { useTheme } from "../../theme/provider";

type ViewMode = "list" | "calendar";

type EntryTone = "warm" | "challenge" | "reflective" | "supportive";

type CalendarEntry = {
  id: string;
  date: Date;
  title: string;
  content: string;
  tags: string[];
  isFavorite: boolean;
  tone: EntryTone;
  icon: typeof Heart;
};

const sampleEntries: CalendarEntry[] = [
  {
    id: "mar-15",
    date: new Date(2026, 2, 15),
    title: "Morning Reflections",
    content:
      "Started the day with a beautiful sunrise walk. Feeling grateful for the small moments of peace. The crisp air helped reset my mind for the week ahead.",
    tags: ["gratitude", "morning", "nature"],
    isFavorite: true,
    tone: "supportive",
    icon: Heart,
  },
  {
    id: "mar-14",
    date: new Date(2026, 2, 14),
    title: "Challenging Day at Work",
    content:
      "Today was tough. Had a difficult meeting that didn't go as planned. But I learned something important about speaking up earlier.",
    tags: ["work", "growth", "challenges"],
    isFavorite: false,
    tone: "challenge",
    icon: Smile,
  },
  {
    id: "mar-13",
    date: new Date(2026, 2, 13),
    title: "Evening Meditation",
    content:
      "Spent 20 minutes in meditation tonight. My mind was racing at first, but eventually found stillness. These pauses seem to help more than I expect.",
    tags: ["meditation", "mindfulness", "evening"],
    isFavorite: true,
    tone: "reflective",
    icon: Sparkles,
  },
  {
    id: "mar-12",
    date: new Date(2026, 2, 12),
    title: "Family Time",
    content:
      "Had dinner with family and felt recharged afterward. The evening was simple, calm, and exactly what I needed.",
    tags: ["family", "connection", "rest"],
    isFavorite: false,
    tone: "warm",
    icon: Heart,
  },
  {
    id: "mar-11",
    date: new Date(2026, 2, 11),
    title: "Planning Ahead",
    content:
      "Spent time organizing tomorrow's tasks. Writing them down reduced a lot of noise in my head and made the evening feel lighter.",
    tags: ["planning", "routine", "focus"],
    isFavorite: false,
    tone: "reflective",
    icon: Star,
  },
];

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

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isSameMonth(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function buildMonthCells(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const offset = firstDay.getDay();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < offset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= monthDays; day += 1) {
    cells.push(new Date(date.getFullYear(), date.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function getToneStyle(theme: ReturnType<typeof useTheme>, tone: EntryTone) {
  if (tone === "warm") {
    return {
      badgeBackground: hexToRgba(theme.colors.success, 0.12),
      badgeForeground: theme.colors.success,
      iconBackground: hexToRgba(theme.colors.success, 0.12),
      iconForeground: theme.colors.success,
    };
  }

  if (tone === "challenge") {
    return {
      badgeBackground: hexToRgba(theme.colors.warning, 0.16),
      badgeForeground: theme.colors.warning,
      iconBackground: hexToRgba(theme.colors.warning, 0.12),
      iconForeground: theme.colors.warning,
    };
  }

  if (tone === "reflective") {
    return {
      badgeBackground: hexToRgba(theme.colors.info, 0.14),
      badgeForeground: theme.colors.info,
      iconBackground: hexToRgba(theme.colors.info, 0.12),
      iconForeground: theme.colors.info,
    };
  }

  return {
    badgeBackground: hexToRgba(theme.colors.primary, 0.12),
    badgeForeground: theme.colors.primary,
    iconBackground: hexToRgba(theme.colors.primary, 0.1),
    iconForeground: theme.colors.primary,
  };
}

function ModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
}) {
  const theme = useTheme();
  const translateX = useRef(new Animated.Value(value === "list" ? 0 : 35)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: value === "list" ? 0 : 35,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [translateX, value]);

  return (
    <View
      style={[
        styles.toggleShell,
        {
          backgroundColor: theme.colors.secondary,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toggleThumb,
          {
            backgroundColor: theme.colors.card,
            transform: [{ translateX }],
          },
        ]}
      />
      {[
        { key: "list" as const, icon: List, label: "List" },
        { key: "calendar" as const, icon: Grid3x3, label: "Calendar" },
      ].map(item => {
        const Icon = item.icon;
        const isActive = value === item.key;

        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${item.label.toLowerCase()} view`}
            onPress={() => onChange(item.key)}
            style={({ pressed }: { pressed: boolean }) => [
              styles.toggleButton,
              isActive && [
                styles.toggleButtonActive,
              ],
              pressed && styles.pressed,
            ]}
          >
            <Icon
              size={14}
              color={isActive ? theme.colors.foreground : theme.colors.mutedForeground}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function StatCard({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.foreground,
        },
      ]}
    >
      <Text style={[styles.statValue, { color: theme.colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function EntryCard({
  entry,
}: {
  entry: CalendarEntry;
}) {
  const theme = useTheme();
  const toneStyle = getToneStyle(theme, entry.tone);
  const Icon = entry.icon;

  return (
    <View
      style={[
        styles.entryCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: entry.isFavorite ? hexToRgba(theme.colors.primary, 0.18) : theme.colors.border,
          shadowColor: theme.colors.foreground,
        },
      ]}
    >
      <View style={styles.entryTopRow}>
        <View style={styles.entryTitleWrap}>
          <View style={styles.entryDateRow}>
            <Icon size={14} color={toneStyle.iconForeground} />
            <Text style={[styles.entryDateText, { color: theme.colors.mutedForeground }]}>
              {formatDateLabel(entry.date)}
            </Text>
          </View>
          <Text style={[styles.entryTitle, { color: theme.colors.foreground }]}>
            {entry.title}
          </Text>
        </View>

        <View style={styles.favoriteWrap}>
          <Star
            size={18}
            fill={entry.isFavorite ? theme.colors.warning : "transparent"}
            color={entry.isFavorite ? theme.colors.warning : theme.colors.mutedForeground}
          />
        </View>
      </View>

      <Text style={[styles.entryContent, { color: theme.colors.mutedForeground }]}>
        {entry.content}
      </Text>

      <View style={styles.tagRow}>
        <Tag size={11} color={theme.colors.mutedForeground} />
        {entry.tags.slice(0, 3).map(tag => (
          <View
            key={tag}
            style={[
              styles.tagPill,
              {
                backgroundColor: theme.colors.secondary,
              },
            ]}
          >
            <Text style={[styles.tagText, { color: theme.colors.secondaryForeground }]}>
              {tag}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function CalendarScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<ViewMode>("list");
  const [currentMonth, setCurrentMonth] = useState(today);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const viewTransition = useRef(new Animated.Value(1)).current;

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 20;
  const layoutMaxWidth = isWide ? 460 : 420;
  const gridCellSize = isCompact ? 38 : isWide ? 48 : 44;
  const gridGap = isCompact ? 6 : 8;

  const monthCells = useMemo(() => buildMonthCells(currentMonth), [currentMonth]);
  const monthEntries = useMemo(
    () => sampleEntries.filter(entry => isSameMonth(entry.date, currentMonth)),
    [currentMonth]
  );
  const selectedEntries = useMemo(
    () =>
      selectedDate
        ? sampleEntries.filter(entry => isSameDay(entry.date, selectedDate))
        : [],
    [selectedDate]
  );

  const totalCount = sampleEntries.length;
  const monthCount = monthEntries.length;
  const favoriteCount = sampleEntries.filter(entry => entry.isFavorite).length;

  const handleMonthShift = (offset: number) => {
    setCurrentMonth(
      previous =>
        new Date(previous.getFullYear(), previous.getMonth() + offset, 1)
    );
    setSelectedDate(null);
  };

  useEffect(() => {
    viewTransition.stopAnimation();
    viewTransition.setValue(0);

    Animated.timing(viewTransition, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [view, viewTransition]);

  return (
    <TabScreenLayout
      backgroundColor={theme.colors.background}
      horizontalPadding={horizontalPadding}
      layoutMaxWidth={layoutMaxWidth}
      scrollContentStyle={styles.content}
      shellStyle={styles.shell}
    >
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: theme.colors.foreground }]}>
          Calendar
        </Text>
        <ModeToggle value={view} onChange={setView} />
      </View>

      <View style={styles.statsRow}>
        <StatCard value={totalCount} label="Total" />
        <StatCard value={monthCount} label="This Month" />
        <StatCard value={favoriteCount} label="Favorites" />
      </View>

      {view === "list" ? (
        <Animated.View
          key="list"
          style={[
            styles.viewTransition,
            {
              opacity: viewTransition,
              transform: [
                {
                  translateY: viewTransition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.listStack}>
            {sampleEntries.map(entry => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </View>
        </Animated.View>
      ) : (
        <Animated.View
          key="calendar"
          style={[
            styles.viewTransition,
            {
              opacity: viewTransition,
              transform: [
                {
                  translateY: viewTransition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
        <View style={styles.calendarStack}>
          <View style={styles.monthHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => handleMonthShift(-1)}
              style={({ pressed }: { pressed: boolean }) => [styles.monthNavButton, pressed && styles.pressed]}
            >
              <ChevronLeft size={20} color={theme.colors.foreground} />
            </Pressable>

            <Text style={[styles.monthLabel, { color: theme.colors.foreground }]}>
              {formatMonthLabel(currentMonth)}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => handleMonthShift(1)}
              style={({ pressed }: { pressed: boolean }) => [styles.monthNavButton, pressed && styles.pressed]}
            >
              <ChevronRight size={20} color={theme.colors.foreground} />
            </Pressable>
          </View>

          <View style={[styles.weekdayRow, { gap: gridGap }]}>
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
              <Text
                key={`${day}-${index}`}
                style={[
                  styles.weekdayLabel,
                  { color: theme.colors.mutedForeground, width: gridCellSize },
                ]}
              >
                {day}
              </Text>
            ))}
          </View>

          <View style={[styles.grid, { gap: gridGap }]}>
            {monthCells.map((cell, index) => {
              if (!cell) {
                return (
                  <View
                    key={`empty-${index}`}
                    style={[
                      styles.dayCell,
                      styles.gridPlaceholder,
                      {
                        width: gridCellSize,
                        height: gridCellSize,
                      },
                    ]}
                  />
                );
              }

              const isToday = isSameDay(cell, today);
              const isSelected = selectedDate ? isSameDay(cell, selectedDate) : false;
              const hasEntry = sampleEntries.some(entry => isSameDay(entry.date, cell));

              return (
                <Pressable
                  key={cell.toISOString()}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${formatDateLabel(cell)}`}
                  onPress={() =>
                    setSelectedDate(previous =>
                      previous && isSameDay(previous, cell) ? null : cell
                    )
                  }
                  style={({ pressed }: { pressed: boolean }) => [
                    styles.dayCell,
                    {
                      width: gridCellSize,
                      height: gridCellSize,
                      borderColor: isSelected ? theme.colors.primary : isToday ? theme.colors.primary : "transparent",
                      backgroundColor: isSelected ? theme.colors.primary : "transparent",
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: isSelected
                          ? theme.colors.primaryForeground
                          : theme.colors.foreground,
                      },
                    ]}
                  >
                    {cell.getDate()}
                  </Text>
                  {hasEntry ? (
                    <View
                      style={[
                        styles.dayDot,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primaryForeground
                            : theme.colors.primary,
                        },
                      ]}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {selectedDate ? (
            <View style={styles.selectedSection}>
              <Text style={[styles.selectedLabel, { color: theme.colors.foreground }]}>
                {formatDateLabel(selectedDate)}
              </Text>

              {selectedEntries.length > 0 ? (
                <View style={styles.listStack}>
                  {selectedEntries.map(entry => (
                    <EntryCard key={entry.id} entry={entry} />
                  ))}
                </View>
              ) : (
                <View
                  style={[
                    styles.emptyCalendarState,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.emptyCalendarTitle, { color: theme.colors.foreground }]}
                  >
                    No entries for this date
                  </Text>
                  <Text
                    style={[styles.emptyCalendarText, { color: theme.colors.mutedForeground }]}
                  >
                    This is a calm placeholder until entry creation is connected.
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </View>
        </Animated.View>
      )}
    </TabScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 14,
  },
  shell: {
    gap: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
  toggleShell: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
    gap: 3,
    overflow: "hidden",
  },
  toggleThumb: {
    position: "absolute",
    left: 3,
    top: 3,
    bottom: 3,
    width: 32,
    borderRadius: 999,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 1,
  },
  toggleButton: {
    width: 32,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleButtonActive: {
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 1,
  },
  statValue: {
    fontSize: 30,
    fontWeight: "600",
    lineHeight: 34,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  listStack: {
    gap: 12,
  },
  viewTransition: {
    width: "100%",
  },
  entryCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 1,
  },
  entryTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  entryTitleWrap: {
    flex: 1,
    gap: 4,
  },
  entryDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  entryDateText: {
    fontSize: 12,
    lineHeight: 16,
  },
  entryTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  favoriteWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  entryContent: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  tagPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    lineHeight: 14,
  },
  calendarStack: {
    gap: 18,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: "600",
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 8,
    paddingHorizontal: 0,
  },
  weekdayLabel: {
    width: 44,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start",
  },
  dayCell: {
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  dayText: {
    fontSize: 15,
    fontWeight: "500",
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
  },
  selectedSection: {
    gap: 12,
    marginTop: 4,
  },
  selectedLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  emptyCalendarState: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyCalendarTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptyCalendarText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 260,
  },
  gridPlaceholder: {
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
