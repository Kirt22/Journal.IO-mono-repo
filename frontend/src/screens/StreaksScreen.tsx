import { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Flame, Trophy, Target } from "lucide-react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import TabScreenLayout from "../components/TabScreenLayout";
import { useTheme } from "../theme/provider";

type StreakMetric = {
  label: string;
  value: string;
};

type Achievement = {
  title: string;
  description: string;
  icon: typeof Trophy;
  unlocked: boolean;
};

const CURRENT_STREAK = 12;
const BEST_STREAK = 12;
const THIS_MONTH_ENTRIES = 5;
const TOTAL_ENTRIES = 5;
const ACTIVITY_PATTERN = new Set([1, 4, 7, 11, 18]);

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

function getDayLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function StatCard({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.statLabel, { color: theme.colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: theme.colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

function AchievementRow({
  achievement,
  theme,
}: {
  achievement: Achievement;
  theme: ReturnType<typeof useTheme>;
}) {
  const Icon = achievement.icon;
  const unlockedRowStyle = useMemo(
    () => ({
      backgroundColor: hexToRgba(theme.colors.primary, 0.1),
    }),
    [theme.colors.primary]
  );
  const lockedRowStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.accent,
    }),
    [theme.colors.accent]
  );

  return (
    <View
      style={[
        styles.achievementRow,
        achievement.unlocked ? unlockedRowStyle : lockedRowStyle,
        !achievement.unlocked ? styles.achievementRowDimmed : null,
      ]}
    >
      <View
        style={[
          styles.achievementIconShell,
          {
            backgroundColor: achievement.unlocked
              ? theme.colors.primary
              : theme.colors.muted,
          },
        ]}
      >
        <Icon
          size={20}
          color={achievement.unlocked ? theme.colors.primaryForeground : theme.colors.mutedForeground}
        />
      </View>

      <View style={styles.achievementCopy}>
        <Text style={[styles.achievementTitle, { color: theme.colors.foreground }]}>
          {achievement.title}
        </Text>
        <Text
          style={[styles.achievementDescription, { color: theme.colors.mutedForeground }]}
        >
          {achievement.description}
        </Text>
      </View>

      {achievement.unlocked ? (
        <Trophy size={16} color={theme.colors.warning} />
      ) : null}
    </View>
  );
}

export default function StreaksScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const shellWidth = Math.max(0, Math.min(width, 430) - 48);
  const gridInnerWidth = Math.max(0, shellWidth - 32);
  const gridGap = 6;
  const gridColumns = 10;
  const tileSize = Math.max(
    18,
    Math.floor((gridInnerWidth - gridGap * (gridColumns - 1)) / gridColumns)
  );
  const activeTileStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.primary,
    }),
    [theme.colors.primary]
  );
  const inactiveTileStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.accent,
    }),
    [theme.colors.accent]
  );
  const todayTileStyle = useMemo(
    () => ({
      borderColor: theme.colors.primary,
      borderWidth: 2,
    }),
    [theme.colors.primary]
  );
  const tileSizeStyle = useMemo(
    () => ({
      width: tileSize,
      height: tileSize,
    }),
    [tileSize]
  );

  const metrics = useMemo<StreakMetric[]>(
    () => [
      { label: "Best Streak", value: String(BEST_STREAK) },
      { label: "This Month", value: String(THIS_MONTH_ENTRIES) },
      { label: "Total", value: String(TOTAL_ENTRIES) },
    ],
    []
  );

  const achievements = useMemo<Achievement[]>(
    () => [
      {
        title: "First Entry",
        description: "Started your journey",
        icon: Trophy,
        unlocked: TOTAL_ENTRIES > 0,
      },
      {
        title: "7-Day Streak",
        description: "Wrote for a week",
        icon: Flame,
        unlocked: CURRENT_STREAK >= 7,
      },
      {
        title: "30-Day Streak",
        description: "A month of consistency",
        icon: Flame,
        unlocked: CURRENT_STREAK >= 30,
      },
      {
        title: "50 Entries",
        description: "Prolific writer",
        icon: Target,
        unlocked: TOTAL_ENTRIES >= 50,
      },
      {
        title: "100 Entries",
        description: "Century club",
        icon: Trophy,
        unlocked: TOTAL_ENTRIES >= 100,
      },
    ],
    []
  );

  const activityDays = useMemo(() => {
    const today = new Date();

    return Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (29 - index));

      return {
        date,
        hasEntry: ACTIVITY_PATTERN.has(index),
        isToday: index === 29,
      };
    });
  }, []);

  return (
    <TabScreenLayout
      backgroundColor={theme.colors.background}
      horizontalPadding={24}
      layoutMaxWidth={430}
    >
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View
              style={[
                styles.headerIconShell,
                {
                  backgroundColor: hexToRgba(theme.colors.primary, 0.1),
                },
              ]}
            >
              <Flame size={24} color={theme.colors.primary} />
            </View>

            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: theme.colors.foreground }]}>
                Streaks & Habits
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                Track your consistency
              </Text>
            </View>
          </View>

          <View style={styles.heroCardWrap}>
            <View style={styles.heroCard}>
              <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="streaks-hero" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0%" stopColor={theme.colors.primary} stopOpacity="1" />
                    <Stop
                      offset="100%"
                      stopColor={theme.colors.primary}
                      stopOpacity="0.82"
                    />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" rx="20" fill="url(#streaks-hero)" />
              </Svg>

              <View style={styles.heroContent}>
                <Flame size={48} color={theme.colors.primaryForeground} />
                <Text style={styles.heroLabel}>Current Streak</Text>
                <Text style={styles.heroValue}>{CURRENT_STREAK}</Text>
                <Text style={styles.heroSuffix}>days in a row</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            {metrics.map(metric => (
              <StatCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                theme={theme}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionStack}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
                30-Day Activity
              </Text>
              <Text
                style={[styles.sectionDescription, { color: theme.colors.mutedForeground }]}
              >
                Your writing consistency
              </Text>
            </View>

            <View style={[styles.activityGrid, { gap: gridGap }]}>
              {activityDays.map(day => (
                <View
                  key={day.date.toISOString()}
                  accessibilityLabel={getDayLabel(day.date)}
                  style={[
                    styles.activityTile,
                    day.hasEntry ? activeTileStyle : inactiveTileStyle,
                    day.isToday ? todayTileStyle : null,
                    tileSizeStyle,
                  ]}
                />
              ))}
            </View>

            <View style={styles.legendRow}>
              <Text style={[styles.legendText, { color: theme.colors.mutedForeground }]}>
                Less
              </Text>
              <View style={[styles.legendSwatch, { backgroundColor: theme.colors.accent }]} />
              <View
                style={[
                  styles.legendSwatch,
                  { backgroundColor: hexToRgba(theme.colors.primary, 0.5) },
                ]}
              />
              <View
                style={[
                  styles.legendSwatch,
                  { backgroundColor: theme.colors.primary },
                ]}
              />
              <Text style={[styles.legendText, { color: theme.colors.mutedForeground }]}>
                More
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
                Achievements
              </Text>
              <Text
                style={[styles.sectionDescription, { color: theme.colors.mutedForeground }]}
              >
                Unlock milestones as you grow
              </Text>
            </View>

            <View style={styles.achievementStack}>
              {achievements.map(achievement => (
                <AchievementRow
                  key={achievement.title}
                  achievement={achievement}
                  theme={theme}
                />
              ))}
            </View>
          </View>
        </View>
      </View>
    </TabScreenLayout>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: "100%",
    paddingTop: 8,
  },
  header: {
    gap: 16,
    paddingBottom: 24,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconShell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "500",
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
  },
  heroCardWrap: {
    overflow: "hidden",
    borderRadius: 24,
  },
  heroCard: {
    minHeight: 176,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  heroContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  heroLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: "#FFFFFFCC",
  },
  heroValue: {
    fontSize: 56,
    lineHeight: 62,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  heroSuffix: {
    fontSize: 14,
    lineHeight: 20,
    color: "#FFFFFFCC",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  statValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  sectionStack: {
    gap: 16,
    paddingBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 16,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  activityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  activityTile: {
    borderRadius: 7,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  legendText: {
    fontSize: 12,
    lineHeight: 16,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  achievementStack: {
    gap: 12,
  },
  achievementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
  },
  achievementRowDimmed: {
    opacity: 0.55,
  },
  achievementIconShell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  achievementCopy: {
    flex: 1,
    gap: 2,
  },
  achievementTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  achievementDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
});
