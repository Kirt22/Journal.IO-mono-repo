import type {
  JadeMessageBlock,
  JadeBlockDataState,
} from "../../types/askJade.types";
import type { MoodValue } from "../../types/mood.types";
import { getInsightsOverview } from "../insights/insights.service";
import { getMoodHistory } from "../mood/mood.service";

export type JadeVisualization =
  | "summary_stats"
  | "mood_trend_7d"
  | "mood_trend_30d"
  | "mood_distribution_30d"
  | "mood_distribution_all_time"
  | "activity_7d";

const EXPLICIT_VISUAL = /\b(graph|chart|plot|visuali[sz]e|stats?|statistics|trend|distribution|breakdown|compare|comparison)\b/i;
const MOOD = /\b(mood|moods|feeling|feelings)\b/i;
const ACTIVITY = /\b(activity|entries|journaling|journal activity|writing activity)\b/i;
const ALL_TIME = /\b(all[ -]?time|ever|overall)\b/i;
const WEEK = /\b(7 days?|week|weekly)\b/i;
const UNNORMALIZED_SIGNAL = /\b(emotion|emotions|emotional|theme|themes)\b/i;

const MOOD_SCORE: Record<MoodValue, number> = {
  terrible: 1,
  bad: 2,
  okay: 3,
  good: 4,
  amazing: 5,
};

const MOOD_LABEL: Record<MoodValue, string> = {
  terrible: "Terrible",
  bad: "Bad",
  okay: "Okay",
  good: "Good",
  amazing: "Amazing",
};

export const detectJadeVisualization = (
  text: string
): JadeVisualization | null => {
  if (!EXPLICIT_VISUAL.test(text)) {
    return null;
  }
  if (/\bactivity\b/i.test(text)) {
    return "activity_7d";
  }
  if (MOOD.test(text)) {
    if (/\b(distribution|breakdown)\b/i.test(text)) {
      return ALL_TIME.test(text)
        ? "mood_distribution_all_time"
        : "mood_distribution_30d";
    }
    return WEEK.test(text) ? "mood_trend_7d" : "mood_trend_30d";
  }
  if (/\b(stats?|statistics|summary|overview)\b/i.test(text)) {
    return "summary_stats";
  }
  if (ACTIVITY.test(text)) {
    return "activity_7d";
  }
  return "mood_trend_30d";
};

export const isUnsupportedJadeVisualization = (text: string): boolean =>
  EXPLICIT_VISUAL.test(text) && UNNORMALIZED_SIGNAL.test(text) && !MOOD.test(text);

const stateForCount = (count: number): JadeBlockDataState =>
  count > 0 ? "ready" : "empty";

const shortDateLabel = (dateKey: string): string => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? dateKey
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(date);
};

const unavailableBlock = (visualization: JadeVisualization): JadeMessageBlock => {
  const common = { dataState: "unavailable" as const, updatedAt: null };
  if (visualization === "summary_stats") {
    return { type: "stats", title: "Your journal at a glance", items: [], ...common };
  }
  if (visualization === "activity_7d") {
    return { type: "activity", title: "Journal activity", rangeDays: 7, points: [], ...common };
  }
  if (visualization.startsWith("mood_distribution")) {
    return {
      type: "mood_distribution",
      title: "Mood distribution",
      range: visualization.endsWith("all_time") ? "all_time" : "30d",
      segments: [],
      ...common,
    };
  }
  return {
    type: "mood_trend",
    title: "Mood trend",
    rangeDays: visualization.endsWith("7d") ? 7 : 30,
    points: [],
    ...common,
  };
};

export const loadJadeVisualizationBlock = async ({
  userId,
  visualization,
  timeZone,
}: {
  userId: string;
  visualization: JadeVisualization;
  timeZone?: string;
}): Promise<JadeMessageBlock> => {
  try {
    if (visualization === "summary_stats" || visualization === "activity_7d") {
      const overview = await getInsightsOverview(userId);
      if (visualization === "summary_stats") {
        const { stats } = overview;
        return {
          type: "stats",
          title: "Your journal at a glance",
          dataState: stateForCount(stats.totalEntries),
          updatedAt: overview.updatedAt,
          items: [
            { label: "Entries", value: String(stats.totalEntries) },
            { label: "Current streak", value: `${stats.currentStreak} days` },
            { label: "Average words", value: String(stats.averageWords) },
            { label: "Favorites", value: String(stats.totalFavorites) },
          ],
        };
      }
      return {
        type: "activity",
        title: "Journal activity",
        dataState: stateForCount(
          overview.activity7d.reduce((total, point) => total + point.count, 0)
        ),
        updatedAt: overview.updatedAt,
        rangeDays: 7,
        points: overview.activity7d,
      };
    }

    if (visualization === "mood_distribution_all_time") {
      const overview = await getInsightsOverview(userId);
      return {
        type: "mood_distribution",
        title: "All-time mood distribution",
        dataState: stateForCount(
          overview.moodDistribution.reduce((total, item) => total + item.count, 0)
        ),
        updatedAt: overview.updatedAt,
        range: "all_time",
        segments: overview.moodDistribution,
      };
    }

    const rangeDays = visualization === "mood_trend_7d" ? 7 : 30;
    const history = await getMoodHistory(userId, {
      days: rangeDays,
      ...(timeZone ? { timeZone } : {}),
    });
    const updatedAt = new Date().toISOString();

    if (visualization === "mood_distribution_30d") {
      const counts = new Map<MoodValue, number>();
      for (const day of history.days) {
        if (day.mood) counts.set(day.mood, (counts.get(day.mood) || 0) + 1);
      }
      const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
      const order: MoodValue[] = ["amazing", "good", "okay", "bad", "terrible"];
      return {
        type: "mood_distribution",
        title: "Mood distribution · 30 days",
        dataState: stateForCount(total),
        updatedAt,
        range: "30d",
        segments: order.map(mood => ({
          mood,
          label: MOOD_LABEL[mood],
          count: counts.get(mood) || 0,
          percentage: total ? Math.round(((counts.get(mood) || 0) / total) * 100) : 0,
        })),
      };
    }

    const observed = history.days.filter(day => day.mood).length;
    return {
      type: "mood_trend",
      title: `Mood trend · ${rangeDays} days`,
      dataState: stateForCount(observed),
      updatedAt,
      rangeDays,
      points: history.days.map(day => ({
        dateKey: day.moodDateKey,
        label: shortDateLabel(day.moodDateKey),
        mood: day.mood,
        score: day.mood ? MOOD_SCORE[day.mood] : null,
      })),
    };
  } catch {
    return unavailableBlock(visualization);
  }
};

export const flattenJadeBlocks = (blocks: JadeMessageBlock[]): string =>
  blocks
    .map(block => {
      if (block.type === "text") return block.text;
      if (block.type === "list") {
        return block.items
          .map((item, index) =>
            block.style === "numbered" ? `${index + 1}. ${item}` : `• ${item}`
          )
          .join("\n");
      }
      if (block.type === "stats") {
        return block.dataState === "ready"
          ? block.items.map(item => `${item.label}: ${item.value}`).join("\n")
          : "There isn't enough journal activity to summarize yet.";
      }
      if (block.dataState === "empty") {
        return "There isn't enough check-in data to draw this yet.";
      }
      if (block.dataState === "unavailable") {
        return "Your data view is temporarily unavailable.";
      }
      return `${block.title} is included in the app.`;
    })
    .filter(Boolean)
    .join("\n\n");
