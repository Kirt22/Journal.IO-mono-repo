import { journalModel } from "../../schema/journal.schema";
import { insightsModel, type IInsights } from "../../schema/insights.schema";
import { moodCheckInModel } from "../../schema/mood.schema";
import { userModel } from "../../schema/user.schema";
import {
  canUseOpenAiForUser,
  getUserAiAccessState,
  requestStructuredOpenAi,
} from "../../helpers/openai.helpers";
import { analyzeJournalTextQuality } from "../../helpers/journalTextQuality.helpers";
import type {
  InsightTone,
  InsightsAiAnalysisCollectingResponse,
  InsightsAiAnalysisInsufficientResponse,
  InsightsAiAnalysisProgress,
  InsightsAiAnalysisReadyResponse,
  InsightsAiAnalysisResponse,
  InsightsAiAnalysisWindow,
  InsightsOverviewResponse,
} from "../../types/insights.types";
import type { MoodValue } from "../../types/mood.types";
import { z } from "zod";

type JournalInsightsSnapshot = {
  userId: string;
  content: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: Date | string;
};

type MoodInsightsSnapshot = {
  userId: string;
  mood: MoodValue;
};

type WeeklyJournalSnapshot = {
  content: string;
  aiPrompt?: string | null;
  tags: string[];
  isFavorite: boolean;
  createdAt: Date;
};

type AnalyzedWeeklyJournalSnapshot = WeeklyJournalSnapshot & {
  analysisText: string;
  analysisWordCount: number;
  reliableTags: string[];
  lowSignalDetected: boolean;
  promptEchoDetected: boolean;
};

type WeeklyMoodSnapshot = {
  mood: MoodValue;
  createdAt: Date;
};

type WeeklyWindowSnapshot = {
  index: number;
  startDateKey: string;
  endDateKey: string;
  label: string;
  timeZone: string;
};

type ConfidenceLevel = "low" | "medium" | "high";

class AiAnalysisDisabledError extends Error {
  constructor() {
    super("AI analysis is turned off for this account.");
    this.name = "AiAnalysisDisabledError";
  }
}

class PremiumFeatureRequiredError extends Error {
  constructor() {
    super("Premium membership is required for this feature.");
    this.name = "PremiumFeatureRequiredError";
  }
}

const MOOD_ORDER: MoodValue[] = [
  "amazing",
  "good",
  "okay",
  "bad",
  "terrible",
];

const MOOD_LABELS: Record<MoodValue, string> = {
  amazing: "Amazing",
  good: "Good",
  okay: "Okay",
  bad: "Bad",
  terrible: "Terrible",
};

const DEFAULT_PROMPTS = [
  {
    topic: "Reflection",
    text: "What felt most steady or grounding in your day?",
  },
  {
    topic: "Patterns",
    text: "Where did your mood shift, and what seemed to influence it?",
  },
  {
    topic: "Next Step",
    text: "What is one small thing you want to carry into tomorrow?",
  },
];
const AI_ANALYSIS_WINDOW_DAYS = 7;
const AI_ANALYSIS_MIN_ACTIVE_DAYS = 4;
const isAiAnalysisDevEarlyReadyEnabled = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.AI_INSIGHTS_DEV_ALLOW_EARLY_READY === "true";
const aiAnalysisEnhancementSchema = z.object({
  summary: z.object({
    headline: z.string().trim().min(1).max(90),
    narrative: z.string().trim().min(1).max(280),
    highlight: z.string().trim().min(1).max(220),
  }),
  patternTags: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(32),
        tone: z.enum(["coral", "blue", "sage", "amber", "slate"]),
      })
    )
    .min(1)
    .max(4),
  actionPlan: z.object({
    headline: z.string().trim().min(1).max(120),
    steps: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(70),
          description: z.string().trim().min(1).max(190),
          focus: z.string().trim().min(1).max(36),
        })
      )
      .min(3)
      .max(3),
  }),
  appSupport: z.object({
    headline: z.string().trim().min(1).max(120),
    items: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(70),
          description: z.string().trim().min(1).max(190),
        })
      )
      .min(3)
      .max(3),
  }),
});
const aiAnalysisEnhancementJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "patternTags", "actionPlan", "appSupport"],
  properties: {
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "narrative", "highlight"],
      properties: {
        headline: { type: "string" },
        narrative: { type: "string" },
        highlight: { type: "string" },
      },
    },
    patternTags: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "tone"],
        properties: {
          label: { type: "string" },
          tone: {
            type: "string",
            enum: ["coral", "blue", "sage", "amber", "slate"],
          },
        },
      },
    },
    actionPlan: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "steps"],
      properties: {
        headline: { type: "string" },
        steps: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "description", "focus"],
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              focus: { type: "string" },
            },
          },
        },
      },
    },
    appSupport: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "items"],
      properties: {
        headline: { type: "string" },
        items: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "description"],
            properties: {
              title: { type: "string" },
              description: { type: "string" },
            },
          },
        },
      },
    },
  },
} satisfies Record<string, unknown>;

const BIG_FIVE_KEYWORDS = {
  openness: [
    "curious",
    "creative",
    "explore",
    "exploring",
    "idea",
    "ideas",
    "learn",
    "learning",
    "new",
    "change",
    "wonder",
    "nature",
    "art",
    "music",
    "book",
    "books",
    "travel",
  ],
  conscientiousness: [
    "plan",
    "planned",
    "planning",
    "routine",
    "routines",
    "goal",
    "goals",
    "focus",
    "focused",
    "finish",
    "finished",
    "schedule",
    "habit",
    "habits",
    "organize",
    "organized",
    "productive",
    "discipline",
    "consistent",
  ],
  extraversion: [
    "friend",
    "friends",
    "team",
    "group",
    "social",
    "party",
    "call",
    "talk",
    "talked",
    "together",
    "community",
    "shared",
    "share",
    "meeting",
    "meet",
    "conversation",
  ],
  agreeableness: [
    "grateful",
    "gratitude",
    "kind",
    "support",
    "supported",
    "help",
    "helped",
    "understand",
    "understood",
    "care",
    "caring",
    "compassion",
    "forgive",
    "forgave",
    "apologize",
    "apologized",
    "trust",
    "appreciate",
    "appreciated",
  ],
  neuroticism: [
    "anxious",
    "anxiety",
    "worry",
    "worried",
    "stress",
    "stressed",
    "overwhelmed",
    "afraid",
    "frustrated",
    "upset",
    "panic",
    "guilty",
    "ashamed",
    "angry",
    "tense",
    "exhausted",
    "tired",
  ],
};

const SUPPORTING_KEYWORDS = {
  calm: ["calm", "steady", "grounded", "peaceful", "rested"],
  conflict: ["conflict", "argument", "fight", "resent", "resentful", "blame"],
  isolation: ["alone", "isolated", "withdraw", "withdrew", "lonely", "avoid"],
  selfFocus: ["deserve", "special", "recognition", "admire", "admired"],
  strategy: ["strategy", "strategic", "leverage", "influence", "advantage"],
  control: ["control", "controlled", "controling", "manage them", "my way"],
  detachment: ["numb", "cold", "detached", "shut off", "didn't care", "dont care"],
  impulsive: ["reckless", "impulsive", "snap", "snapped", "risk"],
};

const BIG_FIVE_LABELS: Record<
  InsightsAiAnalysisReadyResponse["bigFive"][number]["trait"],
  string
> = {
  openness: "Openness",
  conscientiousness: "Conscientiousness",
  extraversion: "Extraversion",
  agreeableness: "Agreeableness",
  neuroticism: "Emotional Sensitivity",
};

const DARK_TRIAD_LABELS: Record<
  InsightsAiAnalysisReadyResponse["darkTriad"][number]["trait"],
  { label: string; supportiveLabel: string }
> = {
  narcissism: {
    label: "Narcissism",
    supportiveLabel: "Self-focus signal",
  },
  machiavellianism: {
    label: "Machiavellianism",
    supportiveLabel: "Control-seeking signal",
  },
  psychopathy: {
    label: "Psychopathy",
    supportiveLabel: "Emotional detachment signal",
  },
};

const getDateKey = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
};

const parseDateKey = (dateKey: string) => {
  const [rawYear = "1970", rawMonth = "01", rawDay = "01"] = dateKey.split("-");
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);

  return {
    year: Number.isFinite(year) ? year : 1970,
    month: Number.isFinite(month) ? month : 1,
    day: Number.isFinite(day) ? day : 1,
  };
};

const isValidTimeZone = (value?: string | null) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const normalizeTimeZone = (value?: string | null) =>
  isValidTimeZone(value) ? value!.trim() : "UTC";

const getTimeZoneParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const readPart = (type: string) =>
    Number(parts.find(part => part.type === type)?.value || "0");

  return {
    year: readPart("year"),
    month: readPart("month"),
    day: readPart("day"),
    hour: readPart("hour"),
    minute: readPart("minute"),
    second: readPart("second"),
  };
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = getTimeZoneParts(date, timeZone);
  const utcEquivalent = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return utcEquivalent - date.getTime();
};

const getUtcForLocalDateTime = ({
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
  timeZone,
}: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  timeZone: string;
}) => {
  let utcTime = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let index = 0; index < 3; index += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utcTime), timeZone);
    const nextUtcTime =
      Date.UTC(year, month - 1, day, hour, minute, second) - offset;

    if (nextUtcTime === utcTime) {
      break;
    }

    utcTime = nextUtcTime;
  }

  return new Date(utcTime);
};

const getLocalDateKey = (value: Date | string, timeZone: string) => {
  const date = value instanceof Date ? value : new Date(value);
  const parts = getTimeZoneParts(date, timeZone);

  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

const addDateKeyDays = (dateKey: string, delta: number) => {
  const { year, month, day } = parseDateKey(dateKey);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + delta);

  return next.toISOString().slice(0, 10);
};

const daysBetweenDateKeys = (startDateKey: string, endDateKey: string) => {
  const start = new Date(`${startDateKey}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDateKey}T00:00:00.000Z`).getTime();

  return Math.max(0, Math.floor((end - start) / 86400000));
};

const buildDateKeyRange = (startDateKey: string, days: number) =>
  Array.from({ length: days }, (_, index) => addDateKeyDays(startDateKey, index));

const getUtcStartForDateKey = (dateKey: string, timeZone: string) => {
  const { year, month, day } = parseDateKey(dateKey);

  return getUtcForLocalDateTime({ year, month, day, timeZone });
};

const monthDayLabelForDateKey = (dateKey: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  }).format(getUtcStartForDateKey(dateKey, timeZone));

const addUtcDays = (date: Date, delta: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
};

const ensureAiAnalysisEnabled = async (userId: string) => {
  const accessState = await getUserAiAccessState(userId);

  if (!accessState.isPremium) {
    throw new PremiumFeatureRequiredError();
  }

  if (accessState.aiOptIn === false) {
    throw new AiAnalysisDisabledError();
  }
};

const startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const daysBetweenUtc = (start: Date, end: Date) => {
  const startMs = startOfUtcDay(start).getTime();
  const endMs = startOfUtcDay(end).getTime();

  return Math.max(0, Math.floor((endMs - startMs) / 86400000));
};

const buildWindowLabel = ({
  startDateKey,
  endDateKey,
  timeZone,
}: {
  startDateKey: string;
  endDateKey: string;
  timeZone: string;
}) => `${monthDayLabelForDateKey(startDateKey, timeZone)} - ${monthDayLabelForDateKey(endDateKey, timeZone)}`;

const resolveWeeklyWindow = ({
  anchorDateKey,
  windowIndex,
  timeZone,
}: {
  anchorDateKey: string;
  windowIndex: number;
  timeZone: string;
}): WeeklyWindowSnapshot => {
  const startDateKey = addDateKeyDays(anchorDateKey, windowIndex * AI_ANALYSIS_WINDOW_DAYS);
  const endDateKey = addDateKeyDays(startDateKey, AI_ANALYSIS_WINDOW_DAYS - 1);

  return {
    index: windowIndex,
    startDateKey,
    endDateKey,
    label: buildWindowLabel({ startDateKey, endDateKey, timeZone }),
    timeZone,
  };
};

const buildWindowFromJournals = ({
  journals,
  window,
}: {
  journals: AnalyzedWeeklyJournalSnapshot[];
  window: WeeklyWindowSnapshot;
}): InsightsAiAnalysisWindow => {
  const totalWords = journals.reduce(
    (sum, journal) => sum + Number(journal.analysisWordCount || 0),
    0
  );
  const activeDays = new Set(
    journals.map(journal => getLocalDateKey(journal.createdAt, window.timeZone))
  ).size;

  return {
    startDate: window.startDateKey,
    endDate: window.endDateKey,
    label: window.label,
    entryCount: journals.length,
    activeDays,
    totalWords,
    minimumActiveDays: AI_ANALYSIS_MIN_ACTIVE_DAYS,
  };
};

const buildProgressSnapshot = ({
  window,
  activeDays,
  entryCount,
  todayDateKey,
  promptState,
}: {
  window: InsightsAiAnalysisWindow;
  activeDays: number;
  entryCount: number;
  todayDateKey: string;
  promptState: InsightsAiAnalysisProgress["promptState"];
}): InsightsAiAnalysisProgress => {
  const daysElapsed = Math.min(
    AI_ANALYSIS_WINDOW_DAYS,
    daysBetweenDateKeys(window.startDate, todayDateKey) + 1
  );
  const entriesNeeded = Math.max(0, AI_ANALYSIS_MIN_ACTIVE_DAYS - activeDays);

  return {
    currentDayOfWindow: Math.max(1, daysElapsed),
    daysRemaining: Math.max(0, AI_ANALYSIS_WINDOW_DAYS - daysElapsed),
    minimumActiveDays: AI_ANALYSIS_MIN_ACTIVE_DAYS,
    activeDays,
    entriesNeeded,
    completionPercentage: Math.max(
      0,
      Math.min(100, Math.round((activeDays / AI_ANALYSIS_MIN_ACTIVE_DAYS) * 100))
    ),
    promptState:
      promptState === "zero_entries" && entryCount > 0 ? "building" : promptState,
  };
};

const countWords = (content: string) => {
  return content.trim().split(/\s+/).filter(Boolean).length;
};

const getFirstSentence = (text: string) => {
  const normalized = text.trim();

  if (!normalized) {
    return "";
  }

  const match = normalized.match(/^[^.?!]+[.?!]?/);
  return (match?.[0] || normalized).trim();
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

const normalizeInsightTags = (tags: string[]) =>
  tags
    .map(tag => tag.trim().toLowerCase())
    .filter(tag => Boolean(tag) && !tag.startsWith("mood:"));

const formatTopicLabel = (tag: string) => {
  return tag
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const readCountMap = (input?: Map<string, number> | null): Map<string, number> => {
  if (!input) {
    return new Map<string, number>();
  }

  return new Map<string, number>(Array.from(input.entries()));
};

const readMoodCountMap = (input?: Map<MoodValue, number> | null): Map<MoodValue, number> => {
  const next = new Map<MoodValue, number>();

  for (const mood of MOOD_ORDER) {
    next.set(mood, Number(input?.get(mood) || 0));
  }

  return next;
};

const updateCountMapValue = (source: Map<string, number>, key: string, delta: number) => {
  const nextValue = Number(source.get(key) || 0) + delta;

  if (nextValue <= 0) {
    source.delete(key);
    return;
  }

  source.set(key, nextValue);
};

const updateMoodMapValue = (source: Map<MoodValue, number>, mood: MoodValue, delta: number) => {
  const nextValue = Number(source.get(mood) || 0) + delta;
  source.set(mood, Math.max(0, nextValue));
};

const getLatestJournalDateKey = (dailyJournalCounts: Map<string, number>) => {
  const activeKeys = Array.from(dailyJournalCounts.entries())
    .filter(([, count]) => count > 0)
    .map(([dateKey]) => dateKey)
    .sort();

  return activeKeys.length > 0 ? activeKeys[activeKeys.length - 1] ?? null : null;
};

const computeCurrentStreak = (dailyJournalCounts: Map<string, number>, today = new Date()) => {
  const todayKey = getDateKey(today);
  const yesterdayKey = getDateKey(addUtcDays(today, -1));
  const hasToday = Number(dailyJournalCounts.get(todayKey) || 0) > 0;
  const hasYesterday = Number(dailyJournalCounts.get(yesterdayKey) || 0) > 0;

  if (!hasToday && !hasYesterday) {
    return 0;
  }

  let cursor = hasToday ? today : addUtcDays(today, -1);
  let streak = 0;

  while (Number(dailyJournalCounts.get(getDateKey(cursor)) || 0) > 0) {
    streak += 1;
    cursor = addUtcDays(cursor, -1);
  }

  return streak;
};

const buildActivity7d = (dailyJournalCounts: Map<string, number>, today = new Date()) => {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addUtcDays(today, index - 6);
    const dateKey = getDateKey(date);

    return {
      dateKey,
      label: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }).format(date),
      count: Number(dailyJournalCounts.get(dateKey) || 0),
    };
  });
};

const buildMoodDistribution = (moodCounts: Map<MoodValue, number>) => {
  const totalCount = MOOD_ORDER.reduce((sum, mood) => sum + Number(moodCounts.get(mood) || 0), 0);

  return MOOD_ORDER.map(mood => {
    const count = Number(moodCounts.get(mood) || 0);

    return {
      mood,
      label: MOOD_LABELS[mood],
      count,
      percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
    };
  });
};

const buildPopularTopics = (tagCounts: Map<string, number>) => {
  const entries = Array.from(tagCounts.entries())
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5);
  const totalCount = entries.reduce((sum, [, count]) => sum + count, 0);

  return entries.map(([tag, count]) => ({
    tag,
    label: formatTopicLabel(tag),
    count,
    percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
  }));
};

const buildOverviewAnalysis = ({
  totalEntries,
  currentStreak,
  dailyJournalCounts,
  moodDistribution,
  popularTopics,
}: {
  totalEntries: number;
  currentStreak: number;
  dailyJournalCounts: Map<string, number>;
  moodDistribution: ReturnType<typeof buildMoodDistribution>;
  popularTopics: ReturnType<typeof buildPopularTopics>;
}) => {
  if (!totalEntries) {
    return {
      summary: "Keep journaling and checking in to unlock supportive patterns here over time.",
      keyInsight:
        "Your insights will grow clearer as you add more entries and mood check-ins.",
      growthPatterns: [
        {
          title: "Just getting started",
          subtitle: "A few more entries will help surface early writing and mood trends.",
        },
      ],
      personalizedPrompts: DEFAULT_PROMPTS,
    };
  }

  const activeDays = Array.from(dailyJournalCounts.values()).filter(count => count > 0).length;
  const dominantMood =
    [...moodDistribution].filter(item => item.count > 0).sort((a, b) => b.count - a.count)[0] ||
    null;
  const topTopic = popularTopics[0] || null;

  const growthPatterns = [
    {
      title: "Consistency",
      subtitle:
        currentStreak > 0
          ? `You're on a ${currentStreak}-day journaling streak right now.`
          : `You've written on ${activeDays} different days so far.`,
    },
    dominantMood
      ? {
          title: "Mood Check-ins",
          subtitle: `${dominantMood.label} appears most often in your recent mood logging.`,
        }
      : null,
    topTopic
      ? {
          title: "Topic Focus",
          subtitle: `${topTopic.label} appears repeatedly across your tagged entries.`,
        }
      : null,
  ].filter(
    (
      item
    ): item is {
      title: string;
      subtitle: string;
    } => Boolean(item)
  );

  const personalizedPrompts = [
    topTopic
      ? {
          topic: topTopic.label,
          text: `What keeps ${topTopic.label.toLowerCase()} showing up in your entries lately?`,
        }
      : null,
    dominantMood
      ? {
          topic: dominantMood.label,
          text: `What seems to influence days when you feel ${dominantMood.label.toLowerCase()}?`,
        }
      : null,
    {
      topic: "Next Step",
      text: "What is one small habit you want to reinforce tomorrow?",
    },
  ].filter(
    (
      item
    ): item is {
      topic: string;
      text: string;
    } => Boolean(item)
  );

  return {
    summary: `You've logged ${totalEntries} entries across ${activeDays} active journaling days. Journal activity may indicate your strongest momentum appears around ${topTopic ? topTopic.label.toLowerCase() : "reflective writing habits"}.`,
    keyInsight: topTopic
      ? `${topTopic.label} appears associated with your recent writing, and your current journaling streak is ${currentStreak} day${currentStreak === 1 ? "" : "s"}.`
      : `Your recent entries suggest a developing journaling rhythm, with a current streak of ${currentStreak} day${currentStreak === 1 ? "" : "s"}.`,
    growthPatterns,
    personalizedPrompts,
  };
};

const toInsightsOverview = (insights: IInsights): InsightsOverviewResponse => {
  const dailyJournalCounts = readCountMap(insights.dailyJournalCounts);
  const tagCounts = readCountMap(insights.tagCounts);
  const moodCounts = readMoodCountMap(insights.moodCounts);
  const totalEntries = Number(insights.totalEntries || 0);
  const averageWords =
    totalEntries > 0 ? Math.round(Number(insights.totalWords || 0) / totalEntries) : 0;
  const currentStreak = computeCurrentStreak(dailyJournalCounts);
  const moodDistribution = buildMoodDistribution(moodCounts);
  const popularTopics = buildPopularTopics(tagCounts);

  return {
    stats: {
      totalEntries,
      currentStreak,
      averageWords,
      totalFavorites: Number(insights.totalFavorites || 0),
    },
    activity7d: buildActivity7d(dailyJournalCounts),
    moodDistribution,
    popularTopics,
    analysis: buildOverviewAnalysis({
      totalEntries,
      currentStreak,
      dailyJournalCounts,
      moodDistribution,
      popularTopics,
    }),
    updatedAt: insights.updatedAt ? insights.updatedAt.toISOString() : null,
  };
};

const monthDayLabel = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);

const readLowerText = (journals: AnalyzedWeeklyJournalSnapshot[]) =>
  journals
    .filter(journal => !journal.lowSignalDetected)
    .map(journal => `${journal.analysisText} ${journal.reliableTags.join(" ")}`.toLowerCase())
    .join(" ");

const analyzeWeeklyJournals = (journals: WeeklyJournalSnapshot[]): AnalyzedWeeklyJournalSnapshot[] =>
  journals.map(journal => {
    const textQuality = analyzeJournalTextQuality({
      content: journal.content || "",
      aiPrompt: journal.aiPrompt,
    });

    return {
      ...journal,
      analysisText: textQuality.analysisText,
      analysisWordCount: textQuality.analysisWordCount,
      reliableTags: textQuality.lowSignalDetected ? [] : normalizeInsightTags(journal.tags),
      lowSignalDetected: textQuality.lowSignalDetected,
      promptEchoDetected: textQuality.promptEchoDetected,
    };
  });

const countKeywordHits = (text: string, keywords: string[]) => {
  return keywords.reduce((sum, keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    const matches = text.match(regex);
    return sum + (matches ? matches.length : 0);
  }, 0);
};

const countPronouns = (text: string, pronouns: string[]) => {
  return pronouns.reduce((sum, pronoun) => {
    const regex = new RegExp(`\\b${pronoun}\\b`, "g");
    const matches = text.match(regex);
    return sum + (matches ? matches.length : 0);
  }, 0);
};

const softenScore = (score: number, confidence: ConfidenceLevel) => {
  const pullFactor = confidence === "high" ? 1 : confidence === "medium" ? 0.72 : 0.45;
  return clamp(50 + (score - 50) * pullFactor, 0, 100);
};

const bandBigFive = (score: number) => {
  if (score >= 67) {
    return "pronounced" as const;
  }

  if (score >= 45) {
    return "steady" as const;
  }

  return "emerging" as const;
};

const bandDarkTriad = (score: number) => {
  if (score >= 60) {
    return "elevated" as const;
  }

  if (score >= 35) {
    return "watch" as const;
  }

  return "low" as const;
};

const confidenceDetails = (entryCount: number, totalWords: number) => {
  if (entryCount >= 6 || totalWords >= 900) {
    return {
      confidence: "high" as const,
      confidenceLabel: "Clearer weekly pattern",
      note: "This view is based on a fuller week of journaling language and mood check-ins.",
    };
  }

  if (entryCount >= 3 || totalWords >= 350) {
    return {
      confidence: "medium" as const,
      confidenceLabel: "Developing weekly signal",
      note: "This week has enough writing to suggest patterns, though they may keep shifting as more entries arrive.",
    };
  }

  return {
    confidence: "low" as const,
    confidenceLabel: "Early weekly signal",
    note: "This read is based on light recent activity, so treat it as a gentle prompt rather than a fixed read on your personality.",
  };
};

const buildPatternTags = ({
  topTopic,
  dominantMood,
  conscientiousness,
  openness,
  extraversion,
  agreeableness,
  neuroticism,
  lowSignalEntryCount,
}: {
  topTopic: { label: string } | null;
  dominantMood: { label: string } | null;
  conscientiousness: number;
  openness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  lowSignalEntryCount: number;
}) => {
  const tags: { label: string; tone: InsightTone }[] = [];

  if (topTopic) {
    tags.push({ label: topTopic.label, tone: "coral" });
  }

  if (conscientiousness >= 60) {
    tags.push({ label: "Routine Seeking", tone: "amber" });
  }

  if (openness >= 60) {
    tags.push({ label: "Curiosity", tone: "blue" });
  }

  if (extraversion >= 58) {
    tags.push({ label: "Connection Energy", tone: "sage" });
  }

  if (agreeableness >= 58) {
    tags.push({ label: "Relationship Care", tone: "sage" });
  }

  if (neuroticism >= 58) {
    tags.push({ label: "Stress Load", tone: "slate" });
  }

  if (dominantMood) {
    tags.push({
      label: `${dominantMood.label} Check-ins`,
      tone: dominantMood.label === "Amazing" || dominantMood.label === "Good" ? "blue" : "slate",
    });
  }

  if (lowSignalEntryCount > 0) {
    tags.push({ label: "Needs Clarity", tone: "slate" });
  }

  return tags.slice(0, 4);
};

const buildBigFiveDescriptions = ({
  topTopic,
  currentStreak,
  activeDays,
  dominantMood,
}: {
  topTopic: { label: string } | null;
  currentStreak: number;
  activeDays: number;
  dominantMood: { label: string } | null;
}) => {
  return {
    openness: {
      pronounced:
        "Your entries suggest openness may be showing up through curiosity, new perspectives, or creative reflection.",
      steady:
        "Your writing suggests a balanced openness this week, with room for both novelty and familiar anchors.",
      emerging:
        "This week leans more toward steadiness than novelty, which may simply reflect a need for familiar routines.",
      evidenceTags: [topTopic?.label || "Reflection", "New perspectives"],
    },
    conscientiousness: {
      pronounced: `Your writing rhythm appears structured this week, supported by ${currentStreak > 0 ? `a ${currentStreak}-day streak` : `${activeDays} active writing days`}.`,
      steady:
        "Your entries suggest a workable level of consistency, even if the routine still has room to settle.",
      emerging:
        "Your week looks more reactive than planned, which may indicate you would benefit from a gentler journaling anchor.",
      evidenceTags: [
        currentStreak > 0 ? `${currentStreak}-day streak` : `${activeDays} active days`,
        "Routine",
      ],
    },
    extraversion: {
      pronounced:
        "Your language suggests energy from people, shared moments, or outward engagement may be showing up more strongly this week.",
      steady:
        "Your writing shows a balanced social orientation, with attention to both connection and personal space.",
      emerging:
        "Your entries lean more inward this week, which may reflect a quieter or more restorative stretch.",
      evidenceTags: [topTopic?.label || "Connection", dominantMood?.label || "Check-ins"],
    },
    agreeableness: {
      pronounced:
        "Your language this week suggests warmth, care, and perspective-taking may be active strengths right now.",
      steady:
        "Your entries suggest a balanced tone between caring for others and staying clear about your own needs.",
      emerging:
        "This week may reflect a stronger focus on self-protection than collaboration, which can happen during higher stress.",
      evidenceTags: ["Care", topTopic?.label || "Relationships"],
    },
    neuroticism: {
      pronounced:
        "Your entries suggest emotional sensitivity may be running higher this week, with stress cues showing up more often in the language.",
      steady:
        "Your week shows some stress reactivity, but it appears to sit alongside moments of regulation and recovery.",
      emerging:
        "Your writing suggests a steadier emotional tone this week, with fewer signs of strain dominating the page.",
      evidenceTags: [dominantMood?.label || "Mood", "Stress cues"],
    },
  };
};

const buildDarkTriadDescriptions = (
  trait: InsightsAiAnalysisReadyResponse["darkTriad"][number]["trait"],
  band: ReturnType<typeof bandDarkTriad>
) => {
  if (trait === "narcissism") {
    return {
      description:
        band === "elevated"
          ? "Some language this week may suggest a stronger need to protect status, image, or recognition. That can be a short-term pressure response and does not define you."
          : band === "watch"
            ? "There are light signs of self-focus in the writing. That may simply mean your attention has been pulled toward personal needs and validation."
            : "Very little in the recent writing points toward image-protection or approval-seeking dominating the week.",
      supportTip: "Balance one self-focused reflection with one note about shared effort or support you received.",
    };
  }

  if (trait === "machiavellianism") {
    return {
      description:
        band === "elevated"
          ? "The language may suggest a stronger pull toward control, guarded planning, or managing outcomes tightly. This often shows up when life feels uncertain."
          : band === "watch"
            ? "There are mild signs of control-seeking or strategic guarding in the week. That can be a normal response to pressure."
            : "There is little recent evidence of tightly controlled or highly guarded interpersonal language.",
      supportTip: "When planning next steps, add one sentence about flexibility or what you can let unfold naturally.",
    };
  }

  return {
    description:
      band === "elevated"
        ? "Some language this week may suggest emotional detachment, bluntness, or shutting down under pressure. That can happen during overload and is not a fixed trait."
        : band === "watch"
          ? "There are light signs of pulling away emotionally when things feel intense. This may reflect fatigue more than indifference."
          : "Recent entries show very little language associated with detachment or emotional bluntness.",
    supportTip: "If you notice yourself going numb, try naming one feeling and one body sensation before the next entry ends.",
  };
};

const buildAiActionPlan = ({
  bigFive,
  darkTriad,
  topTopic,
  currentStreak,
  lowSignalEntryCount,
  promptEchoEntryCount,
}: {
  bigFive: InsightsAiAnalysisReadyResponse["bigFive"];
  darkTriad: InsightsAiAnalysisReadyResponse["darkTriad"];
  topTopic: { label: string } | null;
  currentStreak: number;
  lowSignalEntryCount: number;
  promptEchoEntryCount: number;
}) => {
  const neuroticism = bigFive.find(item => item.trait === "neuroticism");
  const conscientiousness = bigFive.find(item => item.trait === "conscientiousness");
  const agreeableness = bigFive.find(item => item.trait === "agreeableness");
  const watchTrait =
    [...darkTriad].sort((left, right) => right.score - left.score)[0] ?? {
      trait: "narcissism" as const,
      label: "Narcissism",
      supportiveLabel: "Self-focus signal",
      score: 0,
      band: "low" as const,
      description: "",
      supportTip:
        "Balance one self-focused reflection with one note about shared effort or support you received.",
    };

  const steps = [
    lowSignalEntryCount > 0
      ? {
          title: promptEchoEntryCount > 0
            ? "Keep the prompt, add your own sentence"
            : "Make the next entry easier to read",
          description: promptEchoEntryCount > 0
            ? "If you start from a prompt, follow it with one plain sentence about what actually happened and how it felt in you."
            : "Aim for one sentence about what happened, one about how it felt, and one about what you needed so the next read has cleaner signal.",
          focus: "Clarity",
        }
      : neuroticism && neuroticism.score >= 58
        ? {
            title: "Add a two-line decompression check-in",
            description:
              "At the end of each entry, name one stress signal and one thing that helped you regulate. This can make pressure patterns easier to interrupt.",
            focus: "Stress regulation",
          }
        : {
            title: "Keep one signal you can repeat",
            description:
              "Pick one part of your current journaling rhythm that already feels steady and repeat it for the next three days.",
            focus: "Consistency",
          },
    conscientiousness && conscientiousness.score < 50
      ? {
          title: "Anchor journaling to one reliable moment",
          description:
            "Choose one calm time of day and aim for a short entry there. Lowering the friction matters more than writing longer.",
          focus: "Routine building",
        }
      : {
          title: "Protect the streak without raising the bar",
          description:
            currentStreak > 0
              ? `You already have momentum with a ${currentStreak}-day streak. Keep it going with short but honest entries rather than waiting for a perfect moment.`
              : "Keep momentum by choosing short, honest entries over occasional long sessions.",
          focus: "Momentum",
        },
    {
      title: `Use ${topTopic ? topTopic.label : "your strongest recurring topic"} as a reflection thread`,
      description:
        "Revisit the same theme across a few entries and notice whether the tone, triggers, or needs underneath it start to shift.",
      focus: topTopic ? topTopic.label : "Pattern tracking",
    },
    {
      title: `Counter ${watchTrait.supportiveLabel.toLowerCase()} with one balancing prompt`,
      description: watchTrait.supportTip,
      focus: watchTrait.label,
    },
  ];

  return {
    headline:
      "Focus on steadier routines, clearer emotional naming, and one recurring theme this week.",
    steps: steps.slice(0, 3),
  };
};

const buildAppSupport = ({
  topTopic,
  dominantMood,
}: {
  topTopic: { label: string } | null;
  dominantMood: { label: string } | null;
}) => {
  return {
    headline: "Journal.IO can help turn these patterns into gentler habits over time.",
    items: [
      {
        title: "Daily mood check-ins add emotional context",
        description: `Keeping the mood tracker active helps confirm whether ${dominantMood ? dominantMood.label.toLowerCase() : "your emotional tone"} is staying steady or shifting across the week.`,
      },
      {
        title: "Tags make recurring topics easier to spot",
        description: `Tagging entries consistently helps the app notice when themes like ${topTopic ? topTopic.label.toLowerCase() : "your key concerns"} keep returning.`,
      },
      {
        title: "Short prompts can sharpen the next entry",
        description:
          "When a pattern starts to repeat, a focused prompt can help you move from description into clearer self-observation and action.",
      },
    ],
  };
};

const buildReadySummary = ({
  window,
  topTopic,
  dominantMood,
  currentStreak,
  strongestTrait,
  watchTrait,
  lowSignalEntryCount,
  promptEchoEntryCount,
}: {
  window: InsightsAiAnalysisWindow;
  topTopic: { label: string; count: number } | null;
  dominantMood: { mood: MoodValue; label: string } | null;
  currentStreak: number;
  strongestTrait: Pick<InsightsAiAnalysisReadyResponse["bigFive"][number], "label">;
  watchTrait: Pick<
    InsightsAiAnalysisReadyResponse["darkTriad"][number],
    "supportiveLabel" | "supportTip"
  >;
  lowSignalEntryCount: number;
  promptEchoEntryCount: number;
}): InsightsAiAnalysisReadyResponse["summary"] => {
  const activeDayLabel =
    window.activeDays === 1 ? "1 solid day" : `${window.activeDays} solid days`;
  const topicLead = topTopic?.label || "your main reflection thread";
  const moodLead =
    dominantMood?.mood === "amazing" || dominantMood?.mood === "good"
      ? "lighter pockets"
      : dominantMood?.mood === "bad" || dominantMood?.mood === "terrible"
        ? "stress"
        : "mixed energy";
  const streakLead =
    currentStreak > 1 ? `A ${currentStreak}-day streak` : "Your recent consistency";
  const lowSignalLead =
    lowSignalEntryCount > 0
      ? promptEchoEntryCount > 0
        ? "Some of this week's writing still read like prompt carryover, so this view leans on the entries that felt most clearly yours."
        : "Some of this week's writing was hard to read clearly, so this view leans on the entries with the strongest usable signal."
      : "";

  return {
    headline:
      topTopic && topTopic.count >= 2
        ? `${topicLead} kept shaping your week`
        : window.activeDays >= AI_ANALYSIS_MIN_ACTIVE_DAYS
          ? "Your week had more structure than it may have felt"
          : "A few real patterns started to show",
    narrative: `${lowSignalLead ? `${lowSignalLead} ` : ""}${streakLead} plus ${activeDayLabel} gave this read enough signal to feel useful. ${topicLead} kept resurfacing, while ${moodLead} and ${watchTrait.supportiveLabel.toLowerCase()} are worth keeping in view without over-reading them.`,
    highlight: topTopic
      ? `The clearest thread was ${topicLead}. Keep watching what triggers it, what softens it, and what you need around it next week.`
      : `${strongestTrait.label} still showed up in the background, but a few more entries will make the next read feel sharper and more specific.`,
  };
};

const MOOD_SCORE_MAP: Record<MoodValue, number> = {
  amazing: 5,
  good: 4,
  okay: 3,
  bad: 2,
  terrible: 1,
};

const buildScoreboard = ({
  window,
  dominantMood,
}: {
  window: InsightsAiAnalysisWindow;
  dominantMood: { mood: MoodValue; label: string } | null;
}): InsightsAiAnalysisReadyResponse["scoreboard"] => {
  const vibeTone: InsightTone =
    window.activeDays >= 5 ? "sage" : window.activeDays >= 4 ? "blue" : "amber";
  const moodTone: InsightTone =
    dominantMood?.mood === "amazing" || dominantMood?.mood === "good"
      ? "sage"
      : dominantMood?.mood === "bad" || dominantMood?.mood === "terrible"
        ? "slate"
        : "blue";
  const vibeLabel =
    window.activeDays >= 5
      ? "Steadier week"
      : window.activeDays >= 4
        ? "Building momentum"
        : "Still light";

  return {
    vibeLabel,
    vibeTone,
    cards: [
      {
        key: "activeDays" as const,
        label: "Active days",
        value: `${window.activeDays}/7`,
        tone: "sage" as const,
      },
      {
        key: "entries" as const,
        label: "Entries",
        value: `${window.entryCount}`,
        tone: "blue" as const,
      },
      {
        key: "words" as const,
        label: "Words",
        value: `${window.totalWords}`,
        tone: "amber" as const,
      },
      {
        key: "mood" as const,
        label: "Mood signal",
        value: dominantMood?.label || "Mixed",
        tone: moodTone,
      },
    ],
  };
};

const buildEmotionTrend = ({
  journals,
  moods,
  window,
}: {
  journals: WeeklyJournalSnapshot[];
  moods: WeeklyMoodSnapshot[];
  window: WeeklyWindowSnapshot;
}): InsightsAiAnalysisReadyResponse["emotionTrend"] => {
  const dayKeys = buildDateKeyRange(window.startDateKey, AI_ANALYSIS_WINDOW_DAYS);
  const entryCounts = new Map<string, number>();
  const moodsByDate = new Map<string, MoodValue>();

  for (const journal of journals) {
    const dateKey = getLocalDateKey(journal.createdAt, window.timeZone);
    updateCountMapValue(entryCounts, dateKey, 1);
  }

  for (const mood of moods) {
    const dateKey = getLocalDateKey(mood.createdAt, window.timeZone);

    if (!moodsByDate.has(dateKey)) {
      moodsByDate.set(dateKey, mood.mood);
    }
  }

  return {
    headline: "Emotional pace across the week",
    days: dayKeys.map(dateKey => {
      const mood = moodsByDate.get(dateKey) || null;
      const moodScore = mood ? MOOD_SCORE_MAP[mood] : null;

      return {
        dateKey,
        label: new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          timeZone: window.timeZone,
        }).format(getUtcStartForDateKey(dateKey, window.timeZone)),
        moodLabel: mood ? MOOD_LABELS[mood] : null,
        moodScore,
        entryCount: Number(entryCounts.get(dateKey) || 0),
        tone: (
          mood === "amazing" || mood === "good"
            ? "sage"
            : mood === "bad" || mood === "terrible"
              ? "slate"
              : "blue"
        ) as InsightTone,
      };
    }),
  };
};

const buildThemeBreakdown = (
  topTopics: ReturnType<typeof buildPopularTopics>
): InsightsAiAnalysisReadyResponse["themeBreakdown"] => {
  const tones: InsightTone[] = ["coral", "blue", "sage", "amber", "slate"];

  return {
    headline: "Themes that kept resurfacing",
    items: topTopics.slice(0, 4).map((topic, index) => ({
      label: topic.label,
      count: topic.count,
      percentage: topic.percentage,
      tone: tones[index % tones.length] || "blue",
    })),
  };
};

const buildSignals = ({
  topTopics,
  dominantMood,
  positiveMoodShare,
  negativeMoodShare,
  window,
  currentStreak,
  watchTrait,
  lowSignalEntryCount,
  promptEchoEntryCount,
}: {
  topTopics: ReturnType<typeof buildPopularTopics>;
  dominantMood: { mood: MoodValue; label: string } | null;
  positiveMoodShare: number;
  negativeMoodShare: number;
  window: InsightsAiAnalysisWindow;
  currentStreak: number;
  watchTrait: InsightsAiAnalysisReadyResponse["darkTriad"][number];
  lowSignalEntryCount: number;
  promptEchoEntryCount: number;
}): InsightsAiAnalysisReadyResponse["signals"] => {
  const supportiveTopics = topTopics.filter(topic =>
    ["gratitude", "friends", "friendship", "family", "rest", "self care", "self-care", "nature", "exercise", "routine"].includes(
      topic.tag
    )
  );
  const drainingTopics = topTopics.filter(topic =>
    ["work", "stress", "anxiety", "overthinking", "money", "conflict", "sleep", "burnout", "lonely", "loneliness"].includes(
      topic.tag
    )
  );

  const whatHelped: InsightsAiAnalysisReadyResponse["signals"]["whatHelped"] = [
    window.activeDays >= AI_ANALYSIS_MIN_ACTIVE_DAYS
      ? {
          title: "Consistency gave the week more shape",
          description:
            currentStreak > 0
              ? `A ${currentStreak}-day streak kept your reflection rhythm steadier than usual.`
              : `${window.activeDays} active days gave this week enough texture to feel more grounded.`,
          evidence: [`${window.activeDays}/7 active days`, `${window.entryCount} entries`],
          tone: "sage" as const,
        }
      : null,
    positiveMoodShare >= 0.34
      ? {
          title: "There were lighter pockets to build on",
          description:
            dominantMood && (dominantMood.mood === "amazing" || dominantMood.mood === "good")
              ? `${dominantMood.label} check-ins appeared often enough to suggest the week was not all heavy.`
              : "The week still held some easier moments, even if the overall tone felt mixed.",
          evidence: [dominantMood?.label || "Mixed mood", "Mood check-ins"],
          tone: "blue" as const,
        }
      : null,
    supportiveTopics[0]
      ? {
          title: `${supportiveTopics[0].label} seemed grounding`,
          description: `That theme appeared repeatedly, which may mean it is one of the week’s more stabilizing anchors.`,
          evidence: [
            `${supportiveTopics[0].count} mentions`,
            supportiveTopics[0].label,
          ],
          tone: "coral" as const,
        }
      : null,
  ].filter(Boolean) as InsightsAiAnalysisReadyResponse["signals"]["whatHelped"];

  const whatDrained: InsightsAiAnalysisReadyResponse["signals"]["whatDrained"] = [
    lowSignalEntryCount > 0
      ? {
          title:
            promptEchoEntryCount > 0
              ? "Some entries still read like prompt carryover"
              : "Some entries were hard to read clearly",
          description:
            promptEchoEntryCount > 0
              ? "Part of this week leaned more on copied prompt text or filler wording, so Journal.IO weighted the clearer entries more heavily than the noisier ones."
              : "A few entries stayed too short or noisy to support a strong read, so this week leans more on the cleaner writing that was available.",
          evidence: [
            `${lowSignalEntryCount} low-signal entr${lowSignalEntryCount === 1 ? "y" : "ies"}`,
            promptEchoEntryCount > 0 ? `${promptEchoEntryCount} prompt-led` : "Clarity check",
          ],
          tone: "slate" as const,
        }
      : null,
    negativeMoodShare >= 0.34
      ? {
          title: "Stress stayed close to the surface",
          description:
            dominantMood && (dominantMood.mood === "bad" || dominantMood.mood === "terrible")
              ? `${dominantMood.label} check-ins showed up enough to suggest pressure was not just background noise.`
              : "The week carried enough low-energy signals to treat stress as a real factor, not just a passing spike.",
          evidence: [dominantMood?.label || "Low-mood moments", "Mood pattern"],
          tone: "slate" as const,
        }
      : null,
    drainingTopics[0]
      ? {
          title: `${drainingTopics[0].label} kept pulling focus`,
          description:
            "That topic returned often enough to look like a live friction point rather than a one-off mention.",
          evidence: [`${drainingTopics[0].count} mentions`, drainingTopics[0].label],
          tone: "amber" as const,
        }
      : null,
    watchTrait.band !== "low"
      ? {
          title: watchTrait.supportiveLabel,
          description: getFirstSentence(watchTrait.supportTip),
          evidence: [watchTrait.label, watchTrait.band],
          tone: watchTrait.band === "elevated" ? "slate" : "amber",
        }
      : null,
  ].filter(Boolean) as InsightsAiAnalysisReadyResponse["signals"]["whatDrained"];

  const whatKeptShowingUp: InsightsAiAnalysisReadyResponse["signals"]["whatKeptShowingUp"] =
    topTopics.slice(0, 3).map((topic, index) => ({
    title: topic.label,
    description:
      index === 0
        ? "This theme showed up most often, so it is probably the clearest thread to keep tracking next week."
        : "This topic repeated enough to be worth watching for tone shifts, triggers, or needs underneath it.",
    evidence: [`${topic.count} mentions`, `${topic.percentage}% topic share`],
    tone: (["coral", "blue", "sage"][index] || "blue") as InsightTone,
    }));

  return {
    whatHelped:
      whatHelped.length > 0
        ? whatHelped.slice(0, 2)
        : [
            {
              title: "Small steady moments still matter",
              description:
                "Even a lighter week can still hold useful anchors. Keep noticing what feels a little easier, not just what feels hard.",
              evidence: ["Weekly reflection"],
              tone: "blue" as const,
            },
          ],
    whatDrained:
      whatDrained.length > 0
        ? whatDrained.slice(0, 2)
        : [
            {
              title: "No single drain dominated",
              description:
                "Nothing clearly overpowered the week, which may mean the pressure was more diffuse than concentrated.",
              evidence: ["Mixed pattern"],
              tone: "sage" as const,
            },
          ],
    whatKeptShowingUp:
      whatKeptShowingUp.length > 0
        ? whatKeptShowingUp
        : [
            {
              title: "Your writing rhythm itself stood out",
              description:
                "When topics stay broad, the repeating pattern is often the fact that you kept coming back to reflect at all.",
              evidence: [`${window.entryCount} entries`],
              tone: "blue" as const,
            },
          ],
  };
};

const buildWeeklyAiAnalysis = ({
  insights,
  journals,
  moods,
  window,
  today = new Date(),
}: {
  insights: IInsights;
  journals: WeeklyJournalSnapshot[];
  moods: WeeklyMoodSnapshot[];
  window: WeeklyWindowSnapshot;
  today?: Date;
}): InsightsAiAnalysisReadyResponse => {
  const analyzedJournals = analyzeWeeklyJournals(journals);
  const windowMeta = buildWindowFromJournals({ journals: analyzedJournals, window });
  const totalWords = windowMeta.totalWords;
  const activeDays = windowMeta.activeDays;
  const reliableEntryCount = analyzedJournals.filter(journal => !journal.lowSignalDetected).length;
  const lowSignalEntryCount = analyzedJournals.filter(journal => journal.lowSignalDetected).length;
  const promptEchoEntryCount = analyzedJournals.filter(journal => journal.promptEchoDetected).length;
  const confidenceDetailsResult = confidenceDetails(reliableEntryCount, totalWords);
  const normalizedTags = analyzedJournals.flatMap(journal => journal.reliableTags);
  const weeklyTagCounts = new Map<string, number>();

  for (const tag of normalizedTags) {
    updateCountMapValue(weeklyTagCounts, tag, 1);
  }

  const topTopics = buildPopularTopics(weeklyTagCounts);
  const topTopic = topTopics[0] || null;
  const weeklyText = readLowerText(analyzedJournals);
  const uniqueTagCount = new Set(normalizedTags).size;
  const favoriteRatio = analyzedJournals.length
    ? analyzedJournals.filter(journal => journal.isFavorite).length / analyzedJournals.length
    : 0;
  const negativeMoodCount = moods.filter(
    mood => mood.mood === "bad" || mood.mood === "terrible"
  ).length;
  const positiveMoodCount = moods.filter(
    mood => mood.mood === "amazing" || mood.mood === "good"
  ).length;
  const recentMoodShare = moods.length ? negativeMoodCount / moods.length : 0;
  const positiveMoodShare = moods.length ? positiveMoodCount / moods.length : 0;
  const currentStreak = computeCurrentStreak(readCountMap(insights.dailyJournalCounts), today);
  const selfPronouns = countPronouns(weeklyText, ["i", "me", "my", "mine"]);
  const groupPronouns = countPronouns(weeklyText, ["we", "us", "our", "ours"]);
  const pronounRatio =
    selfPronouns + groupPronouns > 0 ? selfPronouns / (selfPronouns + groupPronouns) : 0.5;

  const opennessRaw =
    40 +
    countKeywordHits(weeklyText, BIG_FIVE_KEYWORDS.openness) * 4 +
    uniqueTagCount * 2 +
    favoriteRatio * 8 -
    countKeywordHits(weeklyText, SUPPORTING_KEYWORDS.control) * 2;
  const conscientiousnessRaw =
    42 +
    countKeywordHits(weeklyText, BIG_FIVE_KEYWORDS.conscientiousness) * 5 +
    activeDays * 3 +
    currentStreak * 2 -
    countKeywordHits(weeklyText, BIG_FIVE_KEYWORDS.neuroticism) * 2;
  const extraversionRaw =
    38 +
    countKeywordHits(weeklyText, BIG_FIVE_KEYWORDS.extraversion) * 5 +
    groupPronouns * 2 +
    positiveMoodShare * 16 -
    countKeywordHits(weeklyText, SUPPORTING_KEYWORDS.isolation) * 5;
  const agreeablenessRaw =
    42 +
    countKeywordHits(weeklyText, BIG_FIVE_KEYWORDS.agreeableness) * 5 +
    groupPronouns * 2 -
    countKeywordHits(weeklyText, SUPPORTING_KEYWORDS.conflict) * 5;
  const neuroticismRaw =
    30 +
    countKeywordHits(weeklyText, BIG_FIVE_KEYWORDS.neuroticism) * 7 +
    recentMoodShare * 30 -
    countKeywordHits(weeklyText, BIG_FIVE_KEYWORDS.agreeableness) * 2 -
    countKeywordHits(weeklyText, SUPPORTING_KEYWORDS.calm) * 4;

  const openness = softenScore(clamp(opennessRaw, 15, 92), confidenceDetailsResult.confidence);
  const conscientiousness = softenScore(
    clamp(conscientiousnessRaw, 15, 92),
    confidenceDetailsResult.confidence
  );
  const extraversion = softenScore(
    clamp(extraversionRaw, 10, 90),
    confidenceDetailsResult.confidence
  );
  const agreeableness = softenScore(
    clamp(agreeablenessRaw, 10, 92),
    confidenceDetailsResult.confidence
  );
  const neuroticism = softenScore(
    clamp(neuroticismRaw, 8, 92),
    confidenceDetailsResult.confidence
  );

  const dominantMood = moods.length
    ? buildMoodDistribution(
        moods.reduce((acc, mood) => {
          updateMoodMapValue(acc, mood.mood, 1);
          return acc;
        }, readMoodCountMap())
      )
        .filter(item => item.count > 0)
        .sort((left, right) => right.count - left.count)[0] || null
    : null;

  const descriptions = buildBigFiveDescriptions({
    topTopic,
    currentStreak,
    activeDays,
    dominantMood,
  });

  const bigFive: InsightsAiAnalysisReadyResponse["bigFive"] = [
    {
      trait: "openness",
      label: BIG_FIVE_LABELS.openness,
      score: openness,
      band: bandBigFive(openness),
      description: descriptions.openness[bandBigFive(openness)],
      evidenceTags: descriptions.openness.evidenceTags.filter(Boolean).slice(0, 2),
    },
    {
      trait: "conscientiousness",
      label: BIG_FIVE_LABELS.conscientiousness,
      score: conscientiousness,
      band: bandBigFive(conscientiousness),
      description: descriptions.conscientiousness[bandBigFive(conscientiousness)],
      evidenceTags: descriptions.conscientiousness.evidenceTags.filter(Boolean).slice(0, 2),
    },
    {
      trait: "extraversion",
      label: BIG_FIVE_LABELS.extraversion,
      score: extraversion,
      band: bandBigFive(extraversion),
      description: descriptions.extraversion[bandBigFive(extraversion)],
      evidenceTags: descriptions.extraversion.evidenceTags.filter(Boolean).slice(0, 2),
    },
    {
      trait: "agreeableness",
      label: BIG_FIVE_LABELS.agreeableness,
      score: agreeableness,
      band: bandBigFive(agreeableness),
      description: descriptions.agreeableness[bandBigFive(agreeableness)],
      evidenceTags: descriptions.agreeableness.evidenceTags.filter(Boolean).slice(0, 2),
    },
    {
      trait: "neuroticism",
      label: BIG_FIVE_LABELS.neuroticism,
      score: neuroticism,
      band: bandBigFive(neuroticism),
      description: descriptions.neuroticism[bandBigFive(neuroticism)],
      evidenceTags: descriptions.neuroticism.evidenceTags.filter(Boolean).slice(0, 2),
    },
  ];

  const narcissismScore = softenScore(
    clamp(
      12 +
        pronounRatio * 55 +
        countKeywordHits(weeklyText, SUPPORTING_KEYWORDS.selfFocus) * 6 -
        countKeywordHits(weeklyText, BIG_FIVE_KEYWORDS.agreeableness) * 3,
      0,
      76
    ),
    confidenceDetailsResult.confidence
  );
  const machiavellianismScore = softenScore(
    clamp(
      10 +
        countKeywordHits(weeklyText, SUPPORTING_KEYWORDS.strategy) * 7 +
        countKeywordHits(weeklyText, SUPPORTING_KEYWORDS.control) * 6 +
        countKeywordHits(weeklyText, SUPPORTING_KEYWORDS.conflict) * 3,
      0,
      76
    ),
    confidenceDetailsResult.confidence
  );
  const psychopathyScore = softenScore(
    clamp(
      6 +
        countKeywordHits(weeklyText, SUPPORTING_KEYWORDS.detachment) * 8 +
        countKeywordHits(weeklyText, SUPPORTING_KEYWORDS.impulsive) * 6 +
        countKeywordHits(weeklyText, ["angry", "rage", "cold"]) * 4,
      0,
      72
    ),
    confidenceDetailsResult.confidence
  );

  const darkTriad: InsightsAiAnalysisReadyResponse["darkTriad"] = [
    {
      trait: "narcissism",
      ...DARK_TRIAD_LABELS.narcissism,
      score: narcissismScore,
      band: bandDarkTriad(narcissismScore),
      ...buildDarkTriadDescriptions("narcissism", bandDarkTriad(narcissismScore)),
    },
    {
      trait: "machiavellianism",
      ...DARK_TRIAD_LABELS.machiavellianism,
      score: machiavellianismScore,
      band: bandDarkTriad(machiavellianismScore),
      ...buildDarkTriadDescriptions(
        "machiavellianism",
        bandDarkTriad(machiavellianismScore)
      ),
    },
    {
      trait: "psychopathy",
      ...DARK_TRIAD_LABELS.psychopathy,
      score: psychopathyScore,
      band: bandDarkTriad(psychopathyScore),
      ...buildDarkTriadDescriptions("psychopathy", bandDarkTriad(psychopathyScore)),
    },
  ];

  const patternTags = buildPatternTags({
    topTopic,
    dominantMood,
    conscientiousness,
    openness,
    extraversion,
    agreeableness,
    neuroticism,
    lowSignalEntryCount,
  });

  const strongestTrait =
    [...bigFive].sort((left, right) => right.score - left.score)[0] ?? {
      trait: "conscientiousness" as const,
      label: "Conscientiousness",
      score: 50,
      band: "steady" as const,
      description: "",
      evidenceTags: [],
    };
  const watchTrait =
    [...darkTriad].sort((left, right) => right.score - left.score)[0] ?? {
      trait: "narcissism" as const,
      label: "Narcissism",
      supportiveLabel: "Self-focus signal",
      score: 0,
      band: "low" as const,
      description: "",
      supportTip:
        "Balance one self-focused reflection with one note about shared effort or support you received.",
    };
  const dominantMoodWithValue = dominantMood
    ? {
        mood: dominantMood.mood,
        label: dominantMood.label,
      }
    : null;
  const themeBreakdown = buildThemeBreakdown(topTopics);
  const signals = buildSignals({
    topTopics,
    dominantMood: dominantMoodWithValue,
    positiveMoodShare,
    negativeMoodShare: recentMoodShare,
    window: windowMeta,
    currentStreak,
    watchTrait,
    lowSignalEntryCount,
    promptEchoEntryCount,
  });

  const freshnessNote =
    lowSignalEntryCount > 0
      ? promptEchoEntryCount > 0
        ? `${confidenceDetailsResult.note} Some entries still looked prompt-led, so this read leans on the clearer writing from the week.`
        : `${confidenceDetailsResult.note} Some entries were too short or noisy to weight as strongly as the clearer ones.`
      : confidenceDetailsResult.note;

  return {
    status: "ready",
    window: windowMeta,
    freshness: {
      generatedAt: new Date().toISOString(),
      confidence: confidenceDetailsResult.confidence,
      confidenceLabel: confidenceDetailsResult.confidenceLabel,
      note: freshnessNote,
    },
    summary: buildReadySummary({
      window: windowMeta,
      topTopic,
      dominantMood: dominantMoodWithValue,
      currentStreak,
      strongestTrait,
      watchTrait,
      lowSignalEntryCount,
      promptEchoEntryCount,
    }),
    patternTags,
    scoreboard: buildScoreboard({
      window: windowMeta,
      dominantMood: dominantMoodWithValue,
    }),
    emotionTrend: buildEmotionTrend({
      journals,
      moods,
      window,
    }),
    themeBreakdown,
    signals,
    bigFive,
    darkTriad,
    actionPlan: buildAiActionPlan({
      bigFive,
      darkTriad,
      topTopic,
      currentStreak,
      lowSignalEntryCount,
      promptEchoEntryCount,
    }),
    appSupport: buildAppSupport({
      topTopic,
      dominantMood,
    }),
  };
};

const mergeAiAnalysisEnhancement = (
  analysis: InsightsAiAnalysisReadyResponse,
  enhancement: z.infer<typeof aiAnalysisEnhancementSchema>
): InsightsAiAnalysisReadyResponse => {
  return {
    ...analysis,
    summary: enhancement.summary,
    patternTags: enhancement.patternTags,
    actionPlan: enhancement.actionPlan,
    appSupport: enhancement.appSupport,
  };
};

const buildCollectingAiAnalysis = ({
  window,
  progress,
}: {
  window: InsightsAiAnalysisWindow;
  progress: InsightsAiAnalysisProgress;
}): InsightsAiAnalysisCollectingResponse => {
  const dayLabel =
    progress.daysRemaining === 1
      ? "1 more day"
      : `${progress.daysRemaining} more days`;
  const entryLabel =
    window.entryCount === 1 ? "1 entry" : `${window.entryCount} entries`;

  return {
    status: "collecting",
    window,
    progress,
    summary: {
      headline: "Your first premium week is in motion",
      narrative:
        progress.promptState === "zero_entries"
          ? `This premium week runs ${window.label}. Start with a short, honest entry and Journal.IO will build the first weekly read from there.`
          : `This premium week runs ${window.label}. Keep journaling for ${dayLabel} so the first weekly read can close with enough real context from your own writing.`,
      highlight:
        progress.promptState === "almost_ready"
          ? `You only need ${progress.entriesNeeded} more active day${progress.entriesNeeded === 1 ? "" : "s"} to unlock the first weekly analysis.`
          : `You've logged ${entryLabel} across ${window.activeDays} active day${window.activeDays === 1 ? "" : "s"} so far.`,
    },
    quickAnalysis: {
      available: true,
      title: "Quick Analysis is available now",
      description:
        "Open any saved journal entry to generate a short entry-by-entry AI reflection while the weekly analysis is still collecting.",
    },
  };
};

const buildInsufficientAiAnalysis = ({
  window,
  progress,
}: {
  window: InsightsAiAnalysisWindow;
  progress: InsightsAiAnalysisInsufficientResponse["progress"];
}): InsightsAiAnalysisInsufficientResponse => {
  return {
    status: "insufficient",
    window,
    progress,
    summary: {
      headline: "This week stayed a little too light for a full read",
      narrative:
        window.entryCount > 0
          ? `Journal.IO closed ${window.label} with ${window.activeDays} active day${window.activeDays === 1 ? "" : "s"}. That is useful momentum, but it is still below the 4-day minimum for a grounded weekly analysis.`
          : `Journal.IO closed ${window.label} with no entries, so there was not enough real writing to build a weekly analysis yet.`,
      highlight:
        window.entryCount > 0
          ? `The next premium week is ${progress.nextWindowLabel}. Hit ${AI_ANALYSIS_MIN_ACTIVE_DAYS} active days there and the weekly report will unlock automatically.`
          : `A few honest entries in ${progress.nextWindowLabel} will be enough to start turning this into a real weekly read.`,
    },
    quickAnalysis: {
      available: true,
      title: "Quick Analysis is still available",
      description:
        "You can still open saved entries one by one for a shorter AI reflection while the weekly report rebuilds.",
    },
  };
};

const getAiAnalysisUserContext = async ({
  userId,
  timeZone,
}: {
  userId: string;
  timeZone: string;
}) => {
  const user = await userModel
    .findById(userId)
    .select("createdAt premiumActivatedAt")
    .lean()
    .exec();

  if (!user?.createdAt) {
    throw new Error("Unable to load AI analysis.");
  }

  const anchorDate = new Date(user.premiumActivatedAt || user.createdAt);
  const anchorDateKey = getLocalDateKey(anchorDate, timeZone);

  return {
    anchorDate,
    anchorDateKey,
  };
};

const loadWindowSnapshots = async ({
  userId,
  window,
}: {
  userId: string;
  window: WeeklyWindowSnapshot;
}) => {
  const windowStartUtc = getUtcStartForDateKey(window.startDateKey, window.timeZone);
  const windowEndUtc = getUtcStartForDateKey(
    addDateKeyDays(window.endDateKey, 1),
    window.timeZone
  );

  const [journals, moods] = await Promise.all([
    journalModel
      .find({
        userId,
        createdAt: {
          $gte: windowStartUtc,
          $lt: windowEndUtc,
        },
      })
      .sort({ createdAt: -1 })
      .limit(40)
      .select("content aiPrompt tags isFavorite createdAt")
      .lean()
      .exec(),
    moodCheckInModel
      .find({
        userId,
        createdAt: {
          $gte: windowStartUtc,
          $lt: windowEndUtc,
        },
      })
      .sort({ createdAt: -1 })
      .select("mood createdAt")
      .lean()
      .exec(),
  ]);

  return {
    journals: journals.map(journal => ({
      content: journal.content || "",
      aiPrompt: typeof journal.aiPrompt === "string" ? journal.aiPrompt : null,
      tags: journal.tags || [],
      isFavorite: Boolean(journal.isFavorite),
      createdAt: new Date(journal.createdAt),
    })),
    moods: moods.map(mood => ({
      mood: mood.mood,
      createdAt: new Date(mood.createdAt),
    })),
  };
};

const getCollectingAiAnalysis = async ({
  userId,
  insights,
  timeZone,
  today = new Date(),
  allowEarlyReady = false,
}: {
  userId: string;
  insights: IInsights;
  timeZone: string;
  today?: Date;
  allowEarlyReady?: boolean;
}) => {
  const { anchorDateKey } = await getAiAnalysisUserContext({ userId, timeZone });
  const todayDateKey = getLocalDateKey(today, timeZone);
  const currentWindowIndex = Math.floor(
    daysBetweenDateKeys(anchorDateKey, todayDateKey) / AI_ANALYSIS_WINDOW_DAYS
  );

  if (currentWindowIndex > 0) {
    return null;
  }

  const currentWindow = resolveWeeklyWindow({
    anchorDateKey,
    windowIndex: 0,
    timeZone,
  });
  const { journals } = await loadWindowSnapshots({
    userId,
    window: currentWindow,
  });
  const analyzedJournals = analyzeWeeklyJournals(journals);
  const windowMeta = buildWindowFromJournals({
    journals: analyzedJournals,
    window: currentWindow,
  });

  if (allowEarlyReady && windowMeta.activeDays > 0) {
    return null;
  }

  const progress = buildProgressSnapshot({
    window: windowMeta,
    activeDays: windowMeta.activeDays,
    entryCount: windowMeta.entryCount,
    todayDateKey,
    promptState:
      windowMeta.activeDays <= 0
        ? "zero_entries"
        : windowMeta.activeDays >= AI_ANALYSIS_MIN_ACTIVE_DAYS - 1
          ? "almost_ready"
          : "building",
  });

  return buildCollectingAiAnalysis({
    window: windowMeta,
    progress,
  });
};

const generateAiAnalysisEnhancement = async ({
  userId,
  analysis,
  journals,
  moods,
}: {
  userId: string;
  analysis: InsightsAiAnalysisReadyResponse;
  journals: WeeklyJournalSnapshot[];
  moods: WeeklyMoodSnapshot[];
}) => {
  if (!journals.length || !(await canUseOpenAiForUser(userId))) {
    return null;
  }

  const analyzedJournals = analyzeWeeklyJournals(journals);
  const recentEntries = analyzedJournals.slice(0, 6).map((journal, index) => ({
    order: index + 1,
    createdAt: journal.createdAt.toISOString(),
    tags: journal.reliableTags,
    isFavorite: journal.isFavorite,
    lowSignalDetected: journal.lowSignalDetected,
    promptEchoDetected: journal.promptEchoDetected,
    excerpt: journal.analysisText.trim().slice(0, 360),
  }));
  const moodSummary = buildMoodDistribution(
    moods.reduce((acc, mood) => {
      updateMoodMapValue(acc, mood.mood, 1);
      return acc;
    }, readMoodCountMap())
  ).filter(item => item.count > 0);

  return requestStructuredOpenAi({
    feature: "weekly ai analysis",
    schemaName: "weekly_ai_analysis_enhancement",
    schema: aiAnalysisEnhancementJsonSchema,
    parser: aiAnalysisEnhancementSchema,
    maxOutputTokens: 980,
    messages: [
      {
        role: "system",
        content:
          "You refine Journal.IO's weekly analysis copy. Keep everything non-clinical, uncertainty-aware, emotionally safe, and behavior-focused. Never diagnose, pathologize, or claim certainty. Ground the language in recurring patterns from the provided week, and keep the wording concise enough for a mobile screen. Use a modern, soft Gen Z psychologist tone: warm, sharp, lightly conversational, never slang-heavy, never cringe. Prefer signals, themes, friction points, and next steps over personality-trait framing.",
      },
      {
        role: "user",
        content: JSON.stringify({
          analysisWindow: analysis.window,
          freshness: analysis.freshness,
          scoreboard: analysis.scoreboard,
          baseSummary: analysis.summary,
          signals: analysis.signals,
          themeBreakdown: analysis.themeBreakdown,
          existingPatternTags: analysis.patternTags,
          bigFive: analysis.bigFive.map(item => ({
            trait: item.trait,
            label: item.label,
            score: item.score,
            band: item.band,
            evidenceTags: item.evidenceTags,
          })),
          darkTriad: analysis.darkTriad.map(item => ({
            trait: item.trait,
            supportiveLabel: item.supportiveLabel,
            score: item.score,
            band: item.band,
            supportTip: item.supportTip,
          })),
          currentActionPlan: analysis.actionPlan,
          currentAppSupport: analysis.appSupport,
          moodSummary,
          recentEntries,
        }),
      },
    ],
  });
};

const rebuildInsightsCache = async (userId: string) => {
  const [journals, moodCheckIns] = await Promise.all([
    journalModel.find({ userId }).select("content tags isFavorite createdAt").lean().exec(),
    moodCheckInModel.find({ userId }).select("mood").lean().exec(),
  ]);

  const dailyJournalCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const moodCounts = readMoodCountMap();
  let totalEntries = 0;
  let totalWords = 0;
  let totalFavorites = 0;

  for (const journal of journals) {
    totalEntries += 1;
    totalWords += countWords(journal.content || "");
    totalFavorites += journal.isFavorite ? 1 : 0;

    updateCountMapValue(dailyJournalCounts, getDateKey(journal.createdAt), 1);

    for (const tag of normalizeInsightTags(journal.tags || [])) {
      updateCountMapValue(tagCounts, tag, 1);
    }
  }

  for (const moodCheckIn of moodCheckIns) {
    if (MOOD_ORDER.includes(moodCheckIn.mood)) {
      updateMoodMapValue(moodCounts, moodCheckIn.mood, 1);
    }
  }

  const payload = {
    totalEntries,
    totalWords,
    totalFavorites,
    dailyJournalCounts,
    tagCounts,
    moodCounts,
    lastJournalDateKey: getLatestJournalDateKey(dailyJournalCounts),
    lastCalculatedAt: new Date(),
    aiAnalysis: null,
    aiAnalysisStale: true,
    aiAnalysisComputedAt: null,
    aiAnalysisWindowEndDateKey: null,
    aiAnalysisCacheKey: null,
  };

  await insightsModel
    .findOneAndUpdate(
      { userId },
      {
        $set: payload,
        $setOnInsert: { userId },
      },
      {
        upsert: true,
        new: true,
      }
    )
    .exec();

  return insightsModel.findOne({ userId }).exec();
};

const getOrBuildInsightsCache = async (userId: string) => {
  const existingInsights = await insightsModel.findOne({ userId }).exec();

  if (existingInsights) {
    return existingInsights;
  }

  return rebuildInsightsCache(userId);
};

const markAiAnalysisStale = (insights: IInsights) => {
  insights.aiAnalysisStale = true;
  insights.aiAnalysisWindowEndDateKey = null;
  insights.aiAnalysisCacheKey = null;
};

const applyInsightsDocument = async (userId: string, updater: (insights: IInsights) => void) => {
  const insights = await insightsModel.findOne({ userId }).exec();

  if (!insights) {
    await rebuildInsightsCache(userId);
    return;
  }

  updater(insights);
  insights.lastCalculatedAt = new Date();
  await insights.save();
};

const syncJournalCreatedInsights = async (journal: JournalInsightsSnapshot) => {
  await applyInsightsDocument(journal.userId, insights => {
    const dailyJournalCounts = readCountMap(insights.dailyJournalCounts);
    const tagCounts = readCountMap(insights.tagCounts);
    const dateKey = getDateKey(journal.createdAt);

    insights.totalEntries = Number(insights.totalEntries || 0) + 1;
    insights.totalWords = Number(insights.totalWords || 0) + countWords(journal.content);
    insights.totalFavorites = Number(insights.totalFavorites || 0) + (journal.isFavorite ? 1 : 0);

    updateCountMapValue(dailyJournalCounts, dateKey, 1);

    for (const tag of normalizeInsightTags(journal.tags)) {
      updateCountMapValue(tagCounts, tag, 1);
    }

    insights.dailyJournalCounts = dailyJournalCounts;
    insights.tagCounts = tagCounts;
    insights.lastJournalDateKey = getLatestJournalDateKey(dailyJournalCounts);
    markAiAnalysisStale(insights);
  });
};

const syncJournalUpdatedInsights = async ({
  previousJournal,
  nextJournal,
}: {
  previousJournal: JournalInsightsSnapshot;
  nextJournal: JournalInsightsSnapshot;
}) => {
  await applyInsightsDocument(previousJournal.userId, insights => {
    const dailyJournalCounts = readCountMap(insights.dailyJournalCounts);
    const tagCounts = readCountMap(insights.tagCounts);
    const previousDateKey = getDateKey(previousJournal.createdAt);
    const nextDateKey = getDateKey(nextJournal.createdAt);

    insights.totalWords =
      Number(insights.totalWords || 0) - countWords(previousJournal.content) + countWords(nextJournal.content);
    insights.totalFavorites =
      Number(insights.totalFavorites || 0) -
      (previousJournal.isFavorite ? 1 : 0) +
      (nextJournal.isFavorite ? 1 : 0);

    if (previousDateKey !== nextDateKey) {
      updateCountMapValue(dailyJournalCounts, previousDateKey, -1);
      updateCountMapValue(dailyJournalCounts, nextDateKey, 1);
    }

    for (const tag of normalizeInsightTags(previousJournal.tags)) {
      updateCountMapValue(tagCounts, tag, -1);
    }

    for (const tag of normalizeInsightTags(nextJournal.tags)) {
      updateCountMapValue(tagCounts, tag, 1);
    }

    insights.dailyJournalCounts = dailyJournalCounts;
    insights.tagCounts = tagCounts;
    insights.lastJournalDateKey = getLatestJournalDateKey(dailyJournalCounts);
    markAiAnalysisStale(insights);
  });
};

const syncJournalDeletedInsights = async (journal: JournalInsightsSnapshot) => {
  await applyInsightsDocument(journal.userId, insights => {
    const dailyJournalCounts = readCountMap(insights.dailyJournalCounts);
    const tagCounts = readCountMap(insights.tagCounts);
    const dateKey = getDateKey(journal.createdAt);

    insights.totalEntries = Math.max(0, Number(insights.totalEntries || 0) - 1);
    insights.totalWords = Math.max(0, Number(insights.totalWords || 0) - countWords(journal.content));
    insights.totalFavorites = Math.max(
      0,
      Number(insights.totalFavorites || 0) - (journal.isFavorite ? 1 : 0)
    );

    updateCountMapValue(dailyJournalCounts, dateKey, -1);

    for (const tag of normalizeInsightTags(journal.tags)) {
      updateCountMapValue(tagCounts, tag, -1);
    }

    insights.dailyJournalCounts = dailyJournalCounts;
    insights.tagCounts = tagCounts;
    insights.lastJournalDateKey = getLatestJournalDateKey(dailyJournalCounts);
    markAiAnalysisStale(insights);
  });
};

const syncMoodLoggedInsights = async (moodCheckIn: MoodInsightsSnapshot) => {
  await applyInsightsDocument(moodCheckIn.userId, insights => {
    const moodCounts = readMoodCountMap(insights.moodCounts);
    updateMoodMapValue(moodCounts, moodCheckIn.mood, 1);
    insights.moodCounts = moodCounts;
    markAiAnalysisStale(insights);
  });
};

const getInsightsOverview = async (userId: string): Promise<InsightsOverviewResponse> => {
  const insights = await getOrBuildInsightsCache(userId);

  if (!insights) {
    const rebuiltInsights = await rebuildInsightsCache(userId);

    if (!rebuiltInsights) {
      throw new Error("Unable to load insights overview.");
    }

    return toInsightsOverview(rebuiltInsights);
  }

  return toInsightsOverview(insights);
};

const buildAiAnalysisCacheKey = ({
  window,
  status,
}: {
  window: WeeklyWindowSnapshot;
  status: "ready" | "insufficient";
}) => `${window.startDateKey}:${window.endDateKey}:${window.timeZone}:${status}`;

const refreshAiAnalysisCache = async ({
  userId,
  insights,
  window,
  today = new Date(),
  allowEarlyReady = false,
}: {
  userId: string;
  insights: IInsights;
  window: WeeklyWindowSnapshot;
  today?: Date;
  allowEarlyReady?: boolean;
}) => {
  const { journals, moods } = await loadWindowSnapshots({
    userId,
    window,
  });
  const analyzedJournals = analyzeWeeklyJournals(journals);
  const windowMeta = buildWindowFromJournals({
    journals: analyzedJournals,
    window,
  });

  if (
    windowMeta.activeDays < AI_ANALYSIS_MIN_ACTIVE_DAYS &&
    (!allowEarlyReady || windowMeta.activeDays <= 0)
  ) {
    const nextWindow = resolveWeeklyWindow({
      anchorDateKey: window.startDateKey,
      windowIndex: 1,
      timeZone: window.timeZone,
    });
    const insufficientAnalysis = buildInsufficientAiAnalysis({
      window: windowMeta,
      progress: {
        ...buildProgressSnapshot({
          window: windowMeta,
          activeDays: windowMeta.activeDays,
          entryCount: windowMeta.entryCount,
          todayDateKey: window.endDateKey,
          promptState: "missed",
        }),
        nextWindowStartDate: nextWindow.startDateKey,
        nextWindowEndDate: nextWindow.endDateKey,
        nextWindowLabel: nextWindow.label,
      },
    });

    insights.aiAnalysis = insufficientAnalysis;
    insights.aiAnalysisComputedAt = new Date();
    insights.aiAnalysisStale = false;
    insights.aiAnalysisWindowEndDateKey = window.endDateKey;
    insights.aiAnalysisCacheKey = buildAiAnalysisCacheKey({
      window,
      status: "insufficient",
    });
    await insights.save();

    return insufficientAnalysis;
  }

  const baselineAnalysis = buildWeeklyAiAnalysis({
    insights,
    journals,
    moods,
    window,
    today,
  });
  const analysisEnhancement = await generateAiAnalysisEnhancement({
    userId,
    analysis: baselineAnalysis,
    journals,
    moods,
  });
  const analysis: InsightsAiAnalysisReadyResponse = analysisEnhancement
    ? mergeAiAnalysisEnhancement(baselineAnalysis, analysisEnhancement)
    : baselineAnalysis;

  if (allowEarlyReady && windowMeta.activeDays < AI_ANALYSIS_MIN_ACTIVE_DAYS) {
    analysis.freshness.confidence = "low";
    analysis.freshness.confidenceLabel = "Dev preview";
    analysis.freshness.note =
      `Development override is showing this AI analysis before the normal 4 active-day minimum is met. ${analysis.freshness.note}`;
  }

  insights.aiAnalysis = analysis;
  insights.aiAnalysisComputedAt = new Date();
  insights.aiAnalysisStale = false;
  insights.aiAnalysisWindowEndDateKey = window.endDateKey;
  insights.aiAnalysisCacheKey = buildAiAnalysisCacheKey({
    window,
    status: "ready",
  });
  await insights.save();

  return analysis;
};

const getInsightsAiAnalysis = async (
  userId: string,
  options?: {
    timeZone?: string;
    today?: Date;
  }
): Promise<InsightsAiAnalysisResponse> => {
  await ensureAiAnalysisEnabled(userId);

  const insights = await getOrBuildInsightsCache(userId);
  const allowEarlyReady = isAiAnalysisDevEarlyReadyEnabled();

  if (!insights) {
    throw new Error("Unable to load AI analysis.");
  }

  const timeZone = normalizeTimeZone(options?.timeZone);
  const today = options?.today || new Date();
  const collectingAnalysis = await getCollectingAiAnalysis({
    userId,
    insights,
    timeZone,
    today,
    allowEarlyReady,
  });

  if (collectingAnalysis) {
    return collectingAnalysis;
  }

  const { anchorDateKey } = await getAiAnalysisUserContext({ userId, timeZone });
  const todayDateKey = getLocalDateKey(today, timeZone);
  const currentWindowIndex = Math.floor(
    daysBetweenDateKeys(anchorDateKey, todayDateKey) / AI_ANALYSIS_WINDOW_DAYS
  );
  const closedWindow = resolveWeeklyWindow({
    anchorDateKey,
    windowIndex: Math.max(0, currentWindowIndex - 1),
    timeZone,
  });
  const cachedAnalysis = insights.aiAnalysis as InsightsAiAnalysisResponse | null;
  const cachedStatus =
    cachedAnalysis?.status === "ready" || cachedAnalysis?.status === "insufficient"
      ? cachedAnalysis.status
      : null;

  if (
    cachedAnalysis &&
    cachedStatus &&
    !insights.aiAnalysisStale &&
    insights.aiAnalysisCacheKey ===
      buildAiAnalysisCacheKey({
        window: closedWindow,
        status: cachedStatus,
      })
  ) {
    return cachedAnalysis;
  }

  return refreshAiAnalysisCache({
    userId,
    insights,
    window: closedWindow,
    today,
    allowEarlyReady,
  });
};

export {
  AiAnalysisDisabledError,
  PremiumFeatureRequiredError,
  buildWeeklyAiAnalysis,
  getInsightsOverview,
  getInsightsAiAnalysis,
  mergeAiAnalysisEnhancement,
  rebuildInsightsCache,
  syncJournalCreatedInsights,
  syncJournalDeletedInsights,
  syncJournalUpdatedInsights,
  syncMoodLoggedInsights,
};
