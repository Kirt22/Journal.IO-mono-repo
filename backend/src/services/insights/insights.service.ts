import { journalModel } from "../../schema/journal.schema";
import { insightsModel, type IInsights } from "../../schema/insights.schema";
import { moodCheckInModel } from "../../schema/mood.schema";
import { userModel } from "../../schema/user.schema";
import {
  canUseOpenAiForUser,
  requestEmbedding,
  requestStructuredOpenAi,
} from "../../helpers/openai.helpers";
import {
  AI_ACTION_BALANCE_GUIDANCE,
  AI_REFLECTION_BALANCE_GUIDANCE,
} from "../../helpers/aiReflectionBalance.helpers";
import { buildUserPersonalization } from "../../helpers/userPersonalization.helpers";
import {
  PremiumFeatureRequiredError,
  ensureAiAnalysisEnabled,
} from "../../helpers/aiAccess.helpers";
import {
  loadStoredEntryRegionScores,
  buildRegionTrendMap,
  buildRegionTimeSeries,
  buildRegionFocus,
  MIND_MAP_SCORER_VERSION,
} from "../mindmap/mindmap.service";
import {
  loadEntryInsights,
  aggregateRecurringPatterns,
  buildUserReflectionMemory,
} from "../mindmap/entryInsight.service";
import { analyzeJournalTextQuality } from "../../helpers/journalTextQuality.helpers";
import {
  filterReservedJournalTags,
  isReservedJournalTag,
} from "../../helpers/journalTags.helpers";
import {
  detectJournalSafetySignal,
  hasJournalSafetySignal,
  type JournalSafetySignal,
} from "../../helpers/journalSafety.helpers";
import {
  decryptLeanFields,
  setEncryptedDocumentValue,
} from "../../helpers/fieldEncryption.schema.helpers";
import {
  buildReflectionRegionScore,
  extractReflectionEvidenceSnippets,
  getOverallReflectionTier,
  getReflectionRegionKeywordScore,
  getReflectionRegionTier,
  getReflectionRegionTierLabel,
  getReflectionRegionTrendLabel,
  mindMapActionStepsJsonSchema,
  mindMapActionStepsSchema,
  rankReflectionRegionScores,
  REFLECTION_REGION_DETAILS,
  REFLECTION_REGION_FOCUS_TIPS,
  REFLECTION_REGION_IDS,
  type ReflectionRegionId,
  type ReflectionRegionScore,
  type ReflectionRegionTier,
  type ReflectionRegionTrend,
} from "../../helpers/reflectionMap.helpers";
import type {
  InsightTone,
  InsightsAiAnalysisCollectingResponse,
  InsightsAiAnalysisInsufficientResponse,
  InsightsAiAnalysisProgress,
  InsightsAiAnalysisReadyResponse,
  InsightsAiAnalysisResponse,
  InsightsMindMapBuildingResponse,
  InsightsMindMapPattern,
  InsightsMindMapPeriod,
  InsightsMindMapRange,
  InsightsMindMapReadyResponse,
  InsightsMindMapResponse,
  InsightsMindMapSummary,
  InsightsMindMapSupportFirstResponse,
  InsightsRegionSeriesResponse,
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
  journalId?: string;
  content: string;
  aiPrompt?: string | null;
  tags: string[];
  isFavorite: boolean;
  createdAt: Date;
};

type AnalyzedWeeklyJournalSnapshot = WeeklyJournalSnapshot & {
  strippedText: string;
  analysisText: string;
  analysisWordCount: number;
  reliableTags: string[];
  lowSignalDetected: boolean;
  promptEchoDetected: boolean;
  safetySignal: JournalSafetySignal;
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

type MindMapJournalSnapshot = AnalyzedWeeklyJournalSnapshot & {
  sourceText: string;
};

type ConfidenceLevel = "low" | "medium" | "high";

type LeanJournalInsightsRow = {
  _id: unknown;
  content?: unknown;
  aiPrompt?: unknown;
  tags?: unknown;
  detectedTopics?: unknown;
  isFavorite?: unknown;
  createdAt: Date | string;
};

const MOOD_ORDER: MoodValue[] = ["amazing", "good", "okay", "bad", "terrible"];

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
// Dev/testing: relax the Mind Map readiness thresholds so the "ready" panel
// (tiers, hero, graph) can be reached with a single entry instead of 4 active
// days. Triggered by the AI_ALLOW_NON_PREMIUM bypass, or by the dedicated
// MINDMAP_DEV_BYPASS_MIN_ACTIVE_DAYS flag (non-production only) so a real
// premium account can bypass the active-days gate without also enabling the
// non-premium AI path. Never set either in production.
const MIND_MAP_DEV_BYPASS =
  process.env.NODE_ENV !== "production" &&
  process.env.MINDMAP_DEV_BYPASS_MIN_ACTIVE_DAYS === "true";
const MIND_MAP_RELAX_THRESHOLDS =
  process.env.AI_ALLOW_NON_PREMIUM === "true" || MIND_MAP_DEV_BYPASS;
const MIND_MAP_MIN_ACTIVE_DAYS = MIND_MAP_RELAX_THRESHOLDS ? 1 : 4;
const MIND_MAP_MIN_CLEAR_ENTRIES = MIND_MAP_RELAX_THRESHOLDS ? 1 : 2;
const MIND_MAP_MIN_CLEAR_WORDS = MIND_MAP_RELAX_THRESHOLDS ? 10 : 40;
// The all-time Mind Map is readiness-gated on entry count (day-independent):
// N clear entries — written across any number of days — unlock the ranked map.
const MIND_MAP_MIN_ENTRIES = MIND_MAP_RELAX_THRESHOLDS ? 1 : 5;
// With a dev bypass active, render the premium "ready" panel as soon as there
// is at least one clear entry in the window — skipping the active-days /
// clear-entry / total-word minimums — so the premium Mind Map screens can be
// exercised without days of writing. (getClearMindMapJournals is also relaxed
// under the bypass so short / low-signal dev entries still count.) Requires ≥1
// entry to avoid an empty, NaN-scored map.
const mindMapForceReady = (clearEntryCount: number) =>
  MIND_MAP_RELAX_THRESHOLDS && clearEntryCount >= 1;
const isAiAnalysisDevEarlyReadyEnabled = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.AI_INSIGHTS_EXPERIMENTAL_EARLY_READY === "true";
const aiAnalysisEnhancementSchema = z.object({
  summary: z.object({
    headline: z.string().trim().min(1).max(90),
    narrative: z.string().trim().min(1).max(340),
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
      .min(2)
      .max(2),
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
  patterns: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(48),
        insight: z.string().trim().min(1).max(240),
        evidence: z.array(z.string().trim().min(1).max(120)).min(1).max(3),
        nudge: z.string().trim().min(1).max(180),
        tone: z.enum(["coral", "blue", "sage", "amber", "slate"]),
      })
    )
    .min(1)
    .max(3),
});
const aiAnalysisEnhancementJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "patternTags",
    "actionPlan",
    "appSupport",
    "patterns",
  ],
  properties: {
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "narrative"],
      properties: {
        headline: { type: "string" },
        narrative: { type: "string" },
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
          minItems: 2,
          maxItems: 2,
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
    patterns: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "insight", "evidence", "nudge", "tone"],
        properties: {
          label: { type: "string" },
          insight: { type: "string" },
          evidence: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: { type: "string" },
          },
          nudge: { type: "string" },
          tone: {
            type: "string",
            enum: ["coral", "blue", "sage", "amber", "slate"],
          },
        },
      },
    },
  },
} satisfies Record<string, unknown>;

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
    Number(parts.find((part) => part.type === type)?.value || "0");

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

  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day
  ).padStart(2, "0")}`;
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
  Array.from({ length: days }, (_, index) =>
    addDateKeyDays(startDateKey, index)
  );

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

const startOfUtcDay = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

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
}) =>
  `${monthDayLabelForDateKey(
    startDateKey,
    timeZone
  )} - ${monthDayLabelForDateKey(endDateKey, timeZone)}`;

const resolveWeeklyWindow = ({
  anchorDateKey,
  windowIndex,
  timeZone,
}: {
  anchorDateKey: string;
  windowIndex: number;
  timeZone: string;
}): WeeklyWindowSnapshot => {
  const startDateKey = addDateKeyDays(
    anchorDateKey,
    windowIndex * AI_ANALYSIS_WINDOW_DAYS
  );
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
    journals.map((journal) =>
      getLocalDateKey(journal.createdAt, window.timeZone)
    )
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
      Math.min(
        100,
        Math.round((activeDays / AI_ANALYSIS_MIN_ACTIVE_DAYS) * 100)
      )
    ),
    promptState:
      promptState === "zero_entries" && entryCount > 0
        ? "building"
        : promptState,
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
  filterReservedJournalTags(tags)
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => Boolean(tag) && !tag.startsWith("mood:"));

const formatTopicLabel = (tag: string) => {
  return tag
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const readCountMap = (
  input?: Map<string, number> | Record<string, number> | null
): Map<string, number> => {
  if (!input) {
    return new Map<string, number>();
  }

  if (input instanceof Map) {
    return new Map<string, number>(Array.from(input.entries()));
  }

  if (typeof input === "object") {
    return new Map<string, number>(
      Object.entries(input).map(([key, value]) => [key, Number(value) || 0])
    );
  }

  return new Map<string, number>();
};

const readMoodCountMap = (
  input?: Map<MoodValue, number> | null
): Map<MoodValue, number> => {
  const next = new Map<MoodValue, number>();

  for (const mood of MOOD_ORDER) {
    next.set(mood, Number(input?.get(mood) || 0));
  }

  return next;
};

const updateCountMapValue = (
  source: Map<string, number>,
  key: string,
  delta: number
) => {
  const nextValue = Number(source.get(key) || 0) + delta;

  if (nextValue <= 0) {
    source.delete(key);
    return;
  }

  source.set(key, nextValue);
};

const updateMoodMapValue = (
  source: Map<MoodValue, number>,
  mood: MoodValue,
  delta: number
) => {
  const nextValue = Number(source.get(mood) || 0) + delta;
  source.set(mood, Math.max(0, nextValue));
};

const serializeCountMap = (source: Map<string, number>) =>
  Object.fromEntries(
    Array.from(source.entries()).map(([key, value]) => [key, Number(value) || 0])
  );

const decryptInsightJournalRow = <T extends LeanJournalInsightsRow>(journal: T) =>
  decryptLeanFields(journal, [
    { encryptedPath: "content" },
    { encryptedPath: "aiPrompt" },
    { encryptedPath: "tags" },
  ]);

const toWeeklyJournalSnapshot = (
  journal: LeanJournalInsightsRow
): WeeklyJournalSnapshot => {
  const decryptedJournal = decryptInsightJournalRow(journal);

  return {
    journalId: String(decryptedJournal._id),
    content:
      typeof decryptedJournal.content === "string" ? decryptedJournal.content : "",
    aiPrompt:
      typeof decryptedJournal.aiPrompt === "string"
        ? decryptedJournal.aiPrompt
        : null,
    tags: Array.isArray(decryptedJournal.tags) ? decryptedJournal.tags : [],
    isFavorite: Boolean(decryptedJournal.isFavorite),
    createdAt: new Date(decryptedJournal.createdAt),
  };
};

const setEncryptedInsightsTagCounts = (
  insights: IInsights,
  tagCounts: Map<string, number>
) => {
  setEncryptedDocumentValue(insights, "tagCounts", serializeCountMap(tagCounts));
};

const setEncryptedInsightsPayload = (
  insights: IInsights,
  path: "aiAnalysis" | "mindMapLatestWeek" | "mindMapMonthly" | "mindMapAllTime",
  value: unknown
) => {
  setEncryptedDocumentValue(insights, path, value);
};

const getLatestJournalDateKey = (dailyJournalCounts: Map<string, number>) => {
  const activeKeys = Array.from(dailyJournalCounts.entries())
    .filter(([, count]) => count > 0)
    .map(([dateKey]) => dateKey)
    .sort();

  return activeKeys.length > 0
    ? activeKeys[activeKeys.length - 1] ?? null
    : null;
};

const computeCurrentStreak = (
  dailyJournalCounts: Map<string, number>,
  today = new Date()
) => {
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

const buildActivity7d = (
  dailyJournalCounts: Map<string, number>,
  today = new Date()
) => {
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
  const totalCount = MOOD_ORDER.reduce(
    (sum, mood) => sum + Number(moodCounts.get(mood) || 0),
    0
  );

  return MOOD_ORDER.map((mood) => {
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
    .filter(([tag, count]) => count > 0 && !isReservedJournalTag(tag))
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )
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
      summary:
        "Keep journaling and checking in to unlock supportive patterns here over time.",
      keyInsight:
        "Your insights will grow clearer as you add more entries and mood check-ins.",
      growthPatterns: [
        {
          title: "Just getting started",
          subtitle:
            "A few more entries will help surface early writing and mood trends.",
        },
      ],
      personalizedPrompts: DEFAULT_PROMPTS,
    };
  }

  const activeDays = Array.from(dailyJournalCounts.values()).filter(
    (count) => count > 0
  ).length;
  const dominantMood =
    [...moodDistribution]
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)[0] || null;
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
    summary: `You've logged ${totalEntries} entries across ${activeDays} active journaling days. Journal activity may indicate your strongest momentum appears around ${
      topTopic ? topTopic.label.toLowerCase() : "reflective writing habits"
    }.`,
    keyInsight: topTopic
      ? `${
          topTopic.label
        } appears associated with your recent writing, and your current journaling streak is ${currentStreak} day${
          currentStreak === 1 ? "" : "s"
        }.`
      : `Your recent entries suggest a developing journaling rhythm, with a current streak of ${currentStreak} day${
          currentStreak === 1 ? "" : "s"
        }.`,
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
    totalEntries > 0
      ? Math.round(Number(insights.totalWords || 0) / totalEntries)
      : 0;
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
    .filter(
      (journal) =>
        !journal.lowSignalDetected &&
        !hasJournalSafetySignal(journal.safetySignal)
    )
    .map((journal) =>
      `${journal.analysisText} ${journal.reliableTags.join(" ")}`.toLowerCase()
    )
    .join(" ");

const analyzeWeeklyJournals = (
  journals: WeeklyJournalSnapshot[]
): AnalyzedWeeklyJournalSnapshot[] =>
  journals.map((journal) => {
    const textQuality = analyzeJournalTextQuality({
      content: journal.content || "",
      aiPrompt: journal.aiPrompt,
    });

    const safetySignal = detectJournalSafetySignal(
      textQuality.analysisText || journal.content || ""
    );

    return {
      ...journal,
      strippedText: textQuality.strippedText,
      analysisText: textQuality.analysisText,
      analysisWordCount: textQuality.analysisWordCount,
      reliableTags:
        textQuality.lowSignalDetected || hasJournalSafetySignal(safetySignal)
          ? []
          : normalizeInsightTags(journal.tags),
      lowSignalDetected: textQuality.lowSignalDetected,
      promptEchoDetected: textQuality.promptEchoDetected,
      safetySignal,
    };
  });

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
  topTopics,
  dominantMood,
  positiveMoodShare,
  negativeMoodShare,
  lowSignalEntryCount,
}: {
  topTopics: { label: string }[];
  dominantMood: { label: string } | null;
  positiveMoodShare: number;
  negativeMoodShare: number;
  lowSignalEntryCount: number;
}) => {
  const tags: { label: string; tone: InsightTone }[] = [];

  // Lead with the behavioural threads the week actually kept returning to.
  topTopics.slice(0, 2).forEach((topic, index) => {
    tags.push({ label: topic.label, tone: index === 0 ? "coral" : "blue" });
  });

  if (negativeMoodShare >= 0.34) {
    tags.push({ label: "Stress Load", tone: "slate" });
  } else if (positiveMoodShare >= 0.5) {
    tags.push({ label: "Lighter Stretch", tone: "sage" });
  }

  if (dominantMood) {
    tags.push({
      label: `${dominantMood.label} Check-ins`,
      tone:
        dominantMood.label === "Amazing" || dominantMood.label === "Good"
          ? "blue"
          : "slate",
    });
  }

  if (lowSignalEntryCount > 0) {
    tags.push({ label: "Needs Clarity", tone: "slate" });
  }

  return tags.slice(0, 4);
};

const buildAiActionPlan = ({
  topTopic,
  dominantMood,
  currentStreak,
  negativeMoodShare,
  lowSignalEntryCount,
  promptEchoEntryCount,
}: {
  topTopic: { label: string } | null;
  dominantMood: { label: string } | null;
  currentStreak: number;
  negativeMoodShare: number;
  lowSignalEntryCount: number;
  promptEchoEntryCount: number;
}) => {
  const steps = [
    lowSignalEntryCount > 0
      ? {
          title:
            promptEchoEntryCount > 0
              ? "Keep the prompt, add your own sentence"
              : "Make the next entry easier to read",
          description:
            promptEchoEntryCount > 0
              ? "If you start from a prompt, follow it with one plain sentence about what actually happened and how it felt in you."
              : "Aim for one sentence about what happened, one about how it felt, and one about what you needed so the next read has cleaner signal.",
          focus: "Clarity",
        }
      : negativeMoodShare >= 0.34
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
    {
      title: "Protect the streak without raising the bar",
      description:
        currentStreak > 0
          ? `You already have momentum with a ${currentStreak}-day streak. Keep it going with short but honest entries rather than waiting for a perfect moment.`
          : "Keep momentum by choosing short, honest entries over occasional long sessions.",
      focus: "Momentum",
    },
    {
      title: `Use ${
        topTopic ? topTopic.label : "your strongest recurring topic"
      } as a reflection thread`,
      description:
        "Revisit the same theme across a few entries and notice whether the tone, triggers, or needs underneath it start to shift.",
      focus: topTopic ? topTopic.label : "Pattern tracking",
    },
    dominantMood
      ? {
          title: `Notice what shifts your ${dominantMood.label.toLowerCase()} days`,
          description:
            "Next to one entry, jot the moment your mood turned — up or down — and what was happening right before it. Triggers get easier to spot once they are named.",
          focus: "Triggers",
        }
      : null,
  ].filter(Boolean) as {
    title: string;
    description: string;
    focus: string;
  }[];

  return {
    headline:
      "Focus on steadier routines, clearer emotional naming, and one recurring theme this week.",
    steps: steps.slice(0, 2),
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
    headline:
      "Journal.IO can help turn these patterns into gentler habits over time.",
    items: [
      {
        title: "Daily mood check-ins add emotional context",
        description: `Keeping the mood tracker active helps confirm whether ${
          dominantMood
            ? dominantMood.label.toLowerCase()
            : "your emotional tone"
        } is staying steady or shifting across the week.`,
      },
      {
        title: "Tags make recurring topics easier to spot",
        description: `Tagging entries consistently helps the app notice when themes like ${
          topTopic ? topTopic.label.toLowerCase() : "your key concerns"
        } keep returning.`,
      },
      {
        title: "Short prompts can sharpen the next entry",
        description:
          "When a pattern starts to repeat, a focused prompt can help you move from description into clearer self-observation and action.",
      },
    ],
  };
};

const summarizeWeeklySafetySignals = (
  journals: AnalyzedWeeklyJournalSnapshot[]
) => {
  const safetySignals = journals
    .map((journal) => journal.safetySignal)
    .filter(hasJournalSafetySignal);
  const selfHarmCount = safetySignals.filter(
    (signal) => signal.category === "self_harm"
  ).length;
  const harmToOthersCount = safetySignals.filter(
    (signal) => signal.category === "harm_to_others"
  ).length;
  const urgentCount = safetySignals.filter(
    (signal) => signal.level === "urgent"
  ).length;

  return {
    totalCount: safetySignals.length,
    selfHarmCount,
    harmToOthersCount,
    urgentCount,
    primaryCategory:
      harmToOthersCount > selfHarmCount
        ? ("harm_to_others" as const)
        : selfHarmCount > 0
        ? ("self_harm" as const)
        : ("none" as const),
  };
};

const applyWeeklySafetySupport = ({
  analysis,
  safetySummary,
}: {
  analysis: InsightsAiAnalysisReadyResponse;
  safetySummary: ReturnType<typeof summarizeWeeklySafetySignals>;
}) => {
  if (
    safetySummary.totalCount <= 0 ||
    safetySummary.primaryCategory === "none"
  ) {
    return analysis;
  }

  const isSelfHarm = safetySummary.primaryCategory === "self_harm";
  const supportCopy = isSelfHarm
    ? {
        headline: "One entry needs support before analysis",
        narrative:
          "At least one entry this week may involve self-harm or suicide risk. Journal.IO keeps the entry saved, but avoids turning that wording into normal personality or pattern analysis. If you might act on those thoughts or feel unable to stay safe, contact emergency services now. In the U.S. or Canada, call or text 988.",
        firstStepTitle: "Reach out before reflecting further",
        firstStepDescription:
          "Share this with a trusted person or crisis support before continuing to analyze the week. Immediate safety matters more than interpretation.",
      }
    : {
        headline: "One entry needs a safety-first response",
        narrative:
          "At least one entry this week may involve risk of harm to another person. Journal.IO keeps the entry saved, but avoids turning that wording into normal personality or pattern analysis. If someone could be hurt, create distance from the situation and contact local emergency services or a trusted person now.",
        firstStepTitle: "Create distance and involve support",
        firstStepDescription:
          "Step away from the situation if possible and involve a trusted person or emergency support. Preventing harm matters more than interpretation.",
      };

  return {
    ...analysis,
    freshness: {
      ...analysis.freshness,
      confidence: "low" as const,
      confidenceLabel: "Support-first",
      note: "One or more entries were treated as safety-sensitive, so this weekly read excludes that wording from normal trait and pattern scoring.",
    },
    summary: {
      headline: supportCopy.headline,
      narrative: supportCopy.narrative,
    },
    patternTags: [
      {
        label: "Safety",
        tone: "slate" as const,
      },
      {
        label: "Support First",
        tone: "coral" as const,
      },
      ...analysis.patternTags
        .filter((item) => item.label !== "Safety")
        .slice(0, 1),
    ],
    // Safety-sensitive weeks are excluded from normal behavioural-pattern reads.
    patterns: [],
    actionPlan: {
      headline:
        "Handle safety first, then come back to reflection when things are steadier.",
      steps: [
        {
          title: supportCopy.firstStepTitle,
          description: supportCopy.firstStepDescription,
          focus: "Safety",
        },
        ...analysis.actionPlan.steps.slice(0, 1),
      ],
    },
    appSupport: {
      headline:
        "Journal.IO can save the entry, but it is not a crisis-response service.",
      items: [
        {
          title: "Use real-world support for immediate risk",
          description:
            "If there is any chance of harm, contact emergency services, crisis support, or a trusted person now.",
        },
        {
          title: "Reflect after safety is steadier",
          description:
            "The app can help you notice patterns later, but it should not replace urgent support.",
        },
      ],
    },
  };
};

const buildReadySummary = ({
  window,
  topTopic,
  dominantMood,
  currentStreak,
  lowSignalEntryCount,
  promptEchoEntryCount,
}: {
  window: InsightsAiAnalysisWindow;
  topTopic: { label: string; count: number } | null;
  dominantMood: { mood: MoodValue; label: string } | null;
  currentStreak: number;
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
    currentStreak > 1
      ? `A ${currentStreak}-day streak`
      : "Your recent consistency";
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
    narrative: `${
      lowSignalLead ? `${lowSignalLead} ` : ""
    }${streakLead} plus ${activeDayLabel} gave this read enough signal to feel useful. ${topicLead} kept resurfacing, and ${moodLead} is worth keeping in view without over-reading it. ${
      topTopic
        ? `The clearest thread was ${topicLead} — watch what triggers it, what softens it, and what you need around it next week.`
        : `A clear pattern is still forming, but a few more entries will make the next read feel sharper and more specific.`
    }`,
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
  const dayKeys = buildDateKeyRange(
    window.startDateKey,
    AI_ANALYSIS_WINDOW_DAYS
  );
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
    days: dayKeys.map((dateKey) => {
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
        tone: (mood === "amazing" || mood === "good"
          ? "sage"
          : mood === "bad" || mood === "terrible"
          ? "slate"
          : "blue") as InsightTone,
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
  lowSignalEntryCount,
  promptEchoEntryCount,
}: {
  topTopics: ReturnType<typeof buildPopularTopics>;
  dominantMood: { mood: MoodValue; label: string } | null;
  positiveMoodShare: number;
  negativeMoodShare: number;
  window: InsightsAiAnalysisWindow;
  currentStreak: number;
  lowSignalEntryCount: number;
  promptEchoEntryCount: number;
}): InsightsAiAnalysisReadyResponse["signals"] => {
  const supportiveTopics = topTopics.filter((topic) =>
    [
      "gratitude",
      "friends",
      "friendship",
      "family",
      "rest",
      "self care",
      "self-care",
      "nature",
      "exercise",
      "routine",
    ].includes(topic.tag)
  );
  const drainingTopics = topTopics.filter((topic) =>
    [
      "work",
      "stress",
      "anxiety",
      "overthinking",
      "money",
      "conflict",
      "sleep",
      "burnout",
      "lonely",
      "loneliness",
    ].includes(topic.tag)
  );

  const whatHelped: InsightsAiAnalysisReadyResponse["signals"]["whatHelped"] = [
    window.activeDays >= AI_ANALYSIS_MIN_ACTIVE_DAYS
      ? {
          title: "Consistency gave the week more shape",
          description:
            currentStreak > 0
              ? `A ${currentStreak}-day streak kept your reflection rhythm steadier than usual.`
              : `${window.activeDays} active days gave this week enough texture to feel more grounded.`,
          evidence: [
            `${window.activeDays}/7 active days`,
            `${window.entryCount} entries`,
          ],
          tone: "sage" as const,
        }
      : null,
    positiveMoodShare >= 0.34
      ? {
          title: "There were lighter pockets to build on",
          description:
            dominantMood &&
            (dominantMood.mood === "amazing" || dominantMood.mood === "good")
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

  const whatDrained: InsightsAiAnalysisReadyResponse["signals"]["whatDrained"] =
    [
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
              `${lowSignalEntryCount} low-signal entr${
                lowSignalEntryCount === 1 ? "y" : "ies"
              }`,
              promptEchoEntryCount > 0
                ? `${promptEchoEntryCount} prompt-led`
                : "Clarity check",
            ],
            tone: "slate" as const,
          }
        : null,
      negativeMoodShare >= 0.34
        ? {
            title: "Stress stayed close to the surface",
            description:
              dominantMood &&
              (dominantMood.mood === "bad" || dominantMood.mood === "terrible")
                ? `${dominantMood.label} check-ins showed up enough to suggest pressure was not just background noise.`
                : "The week carried enough low-energy signals to treat stress as a real factor, not just a passing spike.",
            evidence: [
              dominantMood?.label || "Low-mood moments",
              "Mood pattern",
            ],
            tone: "slate" as const,
          }
        : null,
      drainingTopics[0]
        ? {
            title: `${drainingTopics[0].label} kept pulling focus`,
            description:
              "That topic returned often enough to look like a live friction point rather than a one-off mention.",
            evidence: [
              `${drainingTopics[0].count} mentions`,
              drainingTopics[0].label,
            ],
            tone: "amber" as const,
          }
        : null,
    ].filter(
      Boolean
    ) as InsightsAiAnalysisReadyResponse["signals"]["whatDrained"];

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
  const safetySummary = summarizeWeeklySafetySignals(analyzedJournals);
  const windowMeta = buildWindowFromJournals({
    journals: analyzedJournals,
    window,
  });
  const totalWords = windowMeta.totalWords;
  const activeDays = windowMeta.activeDays;
  const reliableEntryCount = analyzedJournals.filter(
    (journal) => !journal.lowSignalDetected
  ).length;
  const lowSignalEntryCount = analyzedJournals.filter(
    (journal) => journal.lowSignalDetected
  ).length;
  const promptEchoEntryCount = analyzedJournals.filter(
    (journal) => journal.promptEchoDetected
  ).length;
  const confidenceDetailsResult = confidenceDetails(
    reliableEntryCount,
    totalWords
  );
  const normalizedTags = analyzedJournals.flatMap(
    (journal) => journal.reliableTags
  );
  const weeklyTagCounts = new Map<string, number>();

  for (const tag of normalizedTags) {
    updateCountMapValue(weeklyTagCounts, tag, 1);
  }

  const topTopics = buildPopularTopics(weeklyTagCounts);
  const topTopic = topTopics[0] || null;
  const weeklyText = readLowerText(analyzedJournals);
  const uniqueTagCount = new Set(normalizedTags).size;
  const favoriteRatio = analyzedJournals.length
    ? analyzedJournals.filter((journal) => journal.isFavorite).length /
      analyzedJournals.length
    : 0;
  const negativeMoodCount = moods.filter(
    (mood) => mood.mood === "bad" || mood.mood === "terrible"
  ).length;
  const positiveMoodCount = moods.filter(
    (mood) => mood.mood === "amazing" || mood.mood === "good"
  ).length;
  const recentMoodShare = moods.length ? negativeMoodCount / moods.length : 0;
  const positiveMoodShare = moods.length ? positiveMoodCount / moods.length : 0;
  const currentStreak = computeCurrentStreak(
    readCountMap(insights.dailyJournalCounts),
    today
  );
  const dominantMood = moods.length
    ? buildMoodDistribution(
        moods.reduce((acc, mood) => {
          updateMoodMapValue(acc, mood.mood, 1);
          return acc;
        }, readMoodCountMap())
      )
        .filter((item) => item.count > 0)
        .sort((left, right) => right.count - left.count)[0] || null
    : null;

  // Deterministic behavioural-pattern fallback from the week's recurring topics.
  // The AI enhancement replaces these with genuinely observed behaviour↔trigger
  // patterns when it runs; this keeps the deterministic baseline non-clinical.
  const patterns: InsightsAiAnalysisReadyResponse["patterns"] = topTopics
    .slice(0, 3)
    .map((topic, index) => ({
      label: topic.label,
      insight: `${topic.label} kept returning across the week — when something resurfaces this often, it usually points to a thread that is still unresolved rather than a passing mention.`,
      evidence: [`${topic.count} mentions`, `${topic.percentage}% of topics`],
      nudge:
        "Next time it comes up, note what happened right before and how it felt in your body — the trigger is usually hiding there.",
      tone: (["coral", "blue", "sage"][index] || "blue") as InsightTone,
    }));

  const patternTags = buildPatternTags({
    topTopics,
    dominantMood,
    positiveMoodShare,
    negativeMoodShare: recentMoodShare,
    lowSignalEntryCount,
  });

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
    lowSignalEntryCount,
    promptEchoEntryCount,
  });

  const freshnessNote =
    lowSignalEntryCount > 0
      ? promptEchoEntryCount > 0
        ? `${confidenceDetailsResult.note} Some entries still looked prompt-led, so this read leans on the clearer writing from the week.`
        : `${confidenceDetailsResult.note} Some entries were too short or noisy to weight as strongly as the clearer ones.`
      : confidenceDetailsResult.note;

  const analysis: InsightsAiAnalysisReadyResponse = {
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
    patterns,
    actionPlan: buildAiActionPlan({
      topTopic,
      dominantMood: dominantMoodWithValue,
      currentStreak,
      negativeMoodShare: recentMoodShare,
      lowSignalEntryCount,
      promptEchoEntryCount,
    }),
    appSupport: buildAppSupport({
      topTopic,
      dominantMood,
    }),
  };

  return applyWeeklySafetySupport({
    analysis,
    safetySummary,
  });
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
    patterns: enhancement.patterns,
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
          ? `You only need ${progress.entriesNeeded} more active day${
              progress.entriesNeeded === 1 ? "" : "s"
            } to unlock the first weekly analysis.`
          : `You've logged ${entryLabel} across ${
              window.activeDays
            } active day${window.activeDays === 1 ? "" : "s"} so far.`,
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
          ? `Journal.IO closed ${window.label} with ${
              window.activeDays
            } active day${
              window.activeDays === 1 ? "" : "s"
            }. That is useful momentum, but it is still below the 4-day minimum for a grounded weekly analysis.`
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
    throw new Error("We couldn't load your AI analysis right now.");
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
  const windowStartUtc = getUtcStartForDateKey(
    window.startDateKey,
    window.timeZone
  );
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
    journals: journals.map(toWeeklyJournalSnapshot),
    moods: moods.map((mood) => ({
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
  const { anchorDateKey } = await getAiAnalysisUserContext({
    userId,
    timeZone,
  });
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
  if (
    analyzedJournals.some((journal) =>
      hasJournalSafetySignal(journal.safetySignal)
    )
  ) {
    return null;
  }

  const recentEntries = analyzedJournals.slice(0, 10).map((journal, index) => ({
    order: index + 1,
    createdAt: journal.createdAt.toISOString(),
    // Coarse local-ish time signal so the model can notice time-of-day rhythms
    // (e.g. "late-night entries carry more of X"). Approximate, not a claim.
    hour: journal.createdAt.getHours(),
    weekday: journal.createdAt.toLocaleDateString("en-US", {
      weekday: "short",
    }),
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
  ).filter((item) => item.count > 0);
  const moodByDay = moods
    .slice()
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .map((mood) => ({
      day: mood.createdAt.toLocaleDateString("en-US", { weekday: "short" }),
      mood: mood.mood,
    }));

  // Cross-entry pattern material (best-effort): the therapist-style themes the
  // per-entry engine already extracted for this window, the recurrence-ranked
  // patterns seen across history, and the rolling long-term memory. This is what
  // lets the weekly read name a real behaviour↔trigger pattern and connect it to
  // the user's longer arc instead of counting keywords. Any failure degrades to
  // the deterministic base without blocking the weekly read.
  let windowThemes: {
    label: string;
    rationale: string;
    evidenceQuote: string;
  }[] = [];
  let recurringPatterns: { label: string; occurrences: number }[] = [];
  let longTermMemory = "";
  try {
    const windowInsights = await loadEntryInsights({
      userId,
      startDate: new Date(`${analysis.window.startDate}T00:00:00.000Z`),
      endDate: new Date(`${analysis.window.endDate}T23:59:59.999Z`),
      limit: 60,
    });
    windowThemes = windowInsights
      .flatMap((insight) => insight.themes)
      .slice(0, 12)
      .map((theme) => ({
        label: theme.label,
        rationale: theme.rationale,
        evidenceQuote: theme.evidenceQuote,
      }));
    recurringPatterns = aggregateRecurringPatterns(
      await loadEntryInsights({ userId, limit: 200 }),
      6
    ).map((pattern) => ({
      label: pattern.label,
      occurrences: pattern.occurrences,
    }));
    const queryEmbedding = await requestEmbedding(
      recentEntries
        .map((entry) => entry.excerpt)
        .join(" ")
        .slice(0, 1600)
    );
    longTermMemory = await buildUserReflectionMemory(userId, { queryEmbedding });
  } catch (error) {
    console.error("Failed to build weekly pattern material:", error);
  }

  const personalization = await buildUserPersonalization(userId);

  return requestStructuredOpenAi({
    feature: "weekly ai analysis",
    schemaName: "weekly_ai_analysis_enhancement",
    schema: aiAnalysisEnhancementJsonSchema,
    parser: aiAnalysisEnhancementSchema,
    maxOutputTokens: 1500,
    messages: [
      {
        role: "system",
        content: [
          "You write Journal.IO's weekly analysis. Read like a perceptive, grounded therapist who has been tracking this person over time — not a keyword counter. Keep everything non-clinical, uncertainty-aware, emotionally safe, and behaviour-focused. Never diagnose, pathologize, or claim certainty. Use a modern, soft Gen Z psychologist tone: warm, sharp, lightly conversational, never slang-heavy, never cringe. Be blunt and to the point everywhere: no filler, no hedging preamble ('it seems like', 'it's worth noting'), no restating the prompt — open every field with the actual observation.",
          "summary.narrative is the primary weekly read: state plainly what happened this week, the concrete trends noticed, and how they moved across the week (built, faded, repeated, shifted). Ground it in the recent entries and themes provided, not generic encouragement.",
          "The most important other output is patterns: 1-3 real behavioural patterns the week surfaced. For each, name the behaviour AND the trigger or feeling it connects to (the link the user usually cannot see themselves — e.g. a habit that spikes with anxiety, reassurance-seeking after conflict, scrolling to avoid a hard feeling). Put the concrete pattern in insight, back it with 1-3 short evidence phrases quoted or closely paraphrased from the provided entries/themes, and give one gentle, practical nudge. Be perceptive and precise, but never diagnose, label, or judge the behaviour as good or bad, never moralise, never shame — the goal is a genuine 'oh, I hadn't seen that' moment, not a clinical read.",
          "Draw patterns from windowThemes and recurringPatterns first (those are already-extracted therapist themes), and use longTermMemory to connect this week to the user's longer arc when it genuinely fits (e.g. 'this is the third week work has shown up right before your mood dips'). Never invent history or a pattern the provided material does not support; when signal is thin, return fewer, softer patterns rather than forcing them.",
          "You may use the entry hours/weekdays and moodByDay to note time-of-day or day-of-week rhythms, but only as a soft observation, never a hard claim.",
          "Also refine summary, patternTags (short behavioural labels, not personality traits), actionPlan (exactly 2 concrete steps, the two that matter most this week), and appSupport (3 items). Keep every field concise enough for a mobile screen — no padding.",
          personalization?.systemDirective,
          AI_REFLECTION_BALANCE_GUIDANCE,
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          userProfile: personalization?.promptProfile ?? null,
          analysisWindow: analysis.window,
          freshness: analysis.freshness,
          scoreboard: analysis.scoreboard,
          baseSummary: analysis.summary,
          signals: analysis.signals,
          themeBreakdown: analysis.themeBreakdown,
          existingPatternTags: analysis.patternTags,
          windowThemes,
          recurringPatterns,
          longTermMemory: longTermMemory || "No prior sessions yet.",
          currentActionPlan: analysis.actionPlan,
          currentAppSupport: analysis.appSupport,
          moodSummary,
          moodByDay,
          recentEntries,
        }),
      },
    ],
  });
};

const MIND_MAP_DISCLAIMER = {
  title: "Reflection signal, not a medical measure",
  body: "Brightness and pulse reflect patterns in your writing. This map is not a brain scan, diagnosis, or medical measure.",
};

const countActiveWritingDays = (
  journals: Array<{ createdAt: Date }>,
  timeZone: string
) =>
  new Set(
    journals.map((journal) => getLocalDateKey(journal.createdAt, timeZone))
  ).size;

const buildMindMapPeriod = ({
  range,
  label,
  startDate,
  endDate,
  journals,
  clearEntryCount,
  totalWords,
  timeZone,
  generatedAt,
}: {
  range: InsightsMindMapRange;
  label: string;
  startDate: string | null;
  endDate: string | null;
  journals: MindMapJournalSnapshot[];
  clearEntryCount: number;
  totalWords: number;
  timeZone: string;
  generatedAt: Date | null;
}): InsightsMindMapPeriod => ({
  range,
  label,
  startDate,
  endDate,
  entryCount: journals.length,
  activeDays: countActiveWritingDays(journals, timeZone),
  clearEntryCount,
  totalWords,
  minimumActiveDays: MIND_MAP_MIN_ACTIVE_DAYS,
  generatedAt: generatedAt ? generatedAt.toISOString() : null,
});

const buildMindMapBuildingResponse = ({
  period,
  summary,
  activeDays,
  clearEntryCount,
  daysRemaining,
  minimumEntries,
}: {
  period: InsightsMindMapPeriod;
  summary: InsightsMindMapSummary;
  activeDays: number;
  clearEntryCount: number;
  daysRemaining: number | null;
  // When provided (all-time), progress is entry-based rather than day-based.
  minimumEntries?: number;
}): InsightsMindMapBuildingResponse => ({
  status: "building",
  period,
  summary,
  progress: {
    activeDays,
    minimumActiveDays: MIND_MAP_MIN_ACTIVE_DAYS,
    clearEntryCount,
    entriesNeeded:
      typeof minimumEntries === "number"
        ? Math.max(0, minimumEntries - clearEntryCount)
        : Math.max(0, MIND_MAP_MIN_ACTIVE_DAYS - activeDays),
    daysRemaining,
  },
  disclaimer: MIND_MAP_DISCLAIMER,
});

const buildMindMapSupportFirstResponse = ({
  period,
  summary,
  support,
}: {
  period: InsightsMindMapPeriod;
  summary: InsightsMindMapSummary;
  support: InsightsMindMapSupportFirstResponse["support"];
}): InsightsMindMapSupportFirstResponse => ({
  status: "support_first",
  period,
  summary,
  support,
  disclaimer: MIND_MAP_DISCLAIMER,
});

const toMindMapJournalSnapshots = (
  journals: AnalyzedWeeklyJournalSnapshot[]
): MindMapJournalSnapshot[] =>
  journals.map((journal) => ({
    ...journal,
    sourceText: journal.strippedText.trim() || journal.content.trim(),
  }));

const getClearMindMapJournals = (journals: MindMapJournalSnapshot[]) =>
  journals.filter(
    (journal) =>
      !hasJournalSafetySignal(journal.safetySignal) &&
      Boolean(journal.sourceText.trim()) &&
      // Dev bypass: accept any safe, non-empty entry so short / low-signal test
      // writing still counts. Otherwise require real clear writing.
      (MIND_MAP_RELAX_THRESHOLDS ||
        (!journal.lowSignalDetected && journal.analysisWordCount >= 4))
  );

// Aggregates the persisted per-entry Mind Map scores (AI where available,
// heuristic otherwise) across the window's clear journals. Legacy entries with
// no stored row fall back to per-entry keyword scoring so the map still works.
const buildMindMapRegions = async ({
  journals,
  activeDays,
}: {
  journals: MindMapJournalSnapshot[];
  activeDays: number;
}) => {
  const clearJournals = getClearMindMapJournals(journals);
  const combinedWriting = clearJournals
    .map((journal) => journal.sourceText)
    .join(" ");

  const journalIds = clearJournals
    .map((journal) => journal.journalId)
    .filter((id): id is string => Boolean(id));
  const storedScores = await loadStoredEntryRegionScores(journalIds);

  const evidenceByRegion = new Map<ReflectionRegionId, string[]>(
    REFLECTION_REGION_IDS.map((id) => [id, []])
  );
  const weightedScoreByRegion = new Map<ReflectionRegionId, number>(
    REFLECTION_REGION_IDS.map((id) => [id, 0])
  );
  let totalWeight = 0;

  for (const journal of clearJournals) {
    const journalWeight = 1 + (journal.isFavorite ? 0.12 : 0);
    totalWeight += journalWeight;

    const stored = journal.journalId
      ? storedScores.get(journal.journalId)
      : undefined;
    const storedById = stored
      ? new Map(stored.regionScores.map((region) => [region.id, region.score]))
      : null;

    // Legacy fallback: per-entry keyword scores normalised to 0-1 so they
    // combine on the same scale as stored per-entry scores.
    const fallbackRaw = new Map<ReflectionRegionId, number>();
    let fallbackMaxRaw = 0;
    if (!storedById) {
      const journalText = `${journal.sourceText} ${journal.reliableTags.join(
        " "
      )}`.trim();
      for (const regionId of REFLECTION_REGION_IDS) {
        const raw = getReflectionRegionKeywordScore(regionId, journalText);
        fallbackRaw.set(regionId, raw);
        fallbackMaxRaw = Math.max(fallbackMaxRaw, raw);
      }
    }

    for (const regionId of REFLECTION_REGION_IDS) {
      const regionScore = storedById
        ? storedById.get(regionId) ?? 0
        : fallbackMaxRaw > 0
        ? (fallbackRaw.get(regionId) || 0) / fallbackMaxRaw
        : REFLECTION_REGION_DETAILS[regionId].lowSignalScore;

      weightedScoreByRegion.set(
        regionId,
        (weightedScoreByRegion.get(regionId) || 0) + regionScore * journalWeight
      );

      // Evidence stays sourced from the user's own writing.
      const nextEvidence = evidenceByRegion.get(regionId) || [];
      if (nextEvidence.length < 3) {
        const evidence = extractReflectionEvidenceSnippets(
          journal.sourceText,
          regionId,
          1
        );
        for (const item of evidence) {
          if (!nextEvidence.includes(item) && nextEvidence.length < 3) {
            nextEvidence.push(item);
          }
        }
        evidenceByRegion.set(regionId, nextEvidence);
      }
    }
  }

  const meanByRegion = new Map<ReflectionRegionId, number>(
    REFLECTION_REGION_IDS.map((regionId) => [
      regionId,
      totalWeight > 0
        ? (weightedScoreByRegion.get(regionId) || 0) / totalWeight
        : REFLECTION_REGION_DETAILS[regionId].lowSignalScore,
    ])
  );
  const highestMean = Math.max(
    ...REFLECTION_REGION_IDS.map((regionId) => meanByRegion.get(regionId) || 0),
    0
  );

  const regions = REFLECTION_REGION_IDS.map((regionId, index) => {
    const mean = meanByRegion.get(regionId) || 0;
    const normalizedScore =
      highestMean > 0
        ? Math.min(1, Number((mean / highestMean).toFixed(2)))
        : REFLECTION_REGION_DETAILS[regionId].lowSignalScore;
    const evidence = evidenceByRegion.get(regionId) || [];
    const confidence = Math.min(
      0.94,
      0.42 +
        normalizedScore * 0.28 +
        Math.min(0.16, evidence.length * 0.07) +
        Math.min(0.14, activeDays * 0.025)
    );

    return buildReflectionRegionScore({
      id: regionId,
      score: normalizedScore,
      confidence,
      rank: index + 1,
      evidence,
      userWriting: combinedWriting,
    });
  });

  return {
    clearJournals,
    combinedWriting,
    regions: rankReflectionRegionScores(regions),
    // Pre-normalization weighted means (absolute engagement) drive the tier
    // read, so a region is compared to a typical reflector rather than to the
    // user's own strongest region.
    regionMeans: meanByRegion,
  };
};

const buildMindMapReadyResponse = ({
  range,
  period,
  regions,
  regionMeans,
  trends,
  patterns,
  actionSteps,
}: {
  range: InsightsMindMapRange;
  period: InsightsMindMapPeriod;
  regions: ReflectionRegionScore[];
  regionMeans: Map<ReflectionRegionId, number>;
  trends: Map<
    ReflectionRegionId,
    { trend: ReflectionRegionTrend; trendLabel: string }
  >;
  patterns: InsightsMindMapPattern[];
  actionSteps: Map<ReflectionRegionId, string>;
}): InsightsMindMapReadyResponse => {
  const strongestRegion = regions[0] as ReflectionRegionScore;
  const periodCopy =
    range === "all_time"
      ? "Across your full reflection history"
      : `Across ${period.label}`;

  const tierByRegion = new Map<ReflectionRegionId, ReflectionRegionTier>(
    regions.map((region) => [
      region.id,
      getReflectionRegionTier(region.id, regionMeans.get(region.id) ?? 0),
    ])
  );

  const responseRegions = regions.map((region) => {
    const regionTrend = trends.get(region.id) ?? {
      trend: "steady" as ReflectionRegionTrend,
      trendLabel: getReflectionRegionTrendLabel(region.id, "steady"),
    };
    const tier = tierByRegion.get(region.id) ?? "low";

    return {
      id: region.id,
      productLabel: region.productName,
      brainRegionSubtitle: region.brainRegion,
      signalScore: region.score,
      confidence: region.confidence,
      rank: region.rank,
      intensity: region.intensity,
      shortInsight: region.shortInsight,
      actionStep: actionSteps.get(region.id) ?? region.actionStep,
      evidenceSnippets: region.evidence,
      trend: regionTrend.trend,
      trendLabel: regionTrend.trendLabel,
      tier,
      tierLabel: getReflectionRegionTierLabel(tier),
    };
  });

  const overallTier = getOverallReflectionTier(
    regions.map((region) => tierByRegion.get(region.id) ?? "low")
  );

  const focus = buildRegionFocus(
    strongestRegion.id,
    responseRegions.map((region) => ({
      id: region.id,
      signalScore: region.signalScore,
      trend: region.trend,
    }))
  );

  return {
    status: "ready",
    period,
    summary: {
      headline: `${strongestRegion.productName} carried the strongest reflection signal`,
      narrative: `${periodCopy}, your writing most often returned to ${strongestRegion.productName.toLowerCase()} patterns. Other regions still appear in the map, but this one showed the clearest consistent signal.`,
      note: "Brightness and pulse reflect recurring patterns in your writing, not literal brain activity.",
    },
    strongestRegionId: strongestRegion.id,
    patterns,
    regions: responseRegions,
    focus,
    overallTier,
    disclaimer: MIND_MAP_DISCLAIMER,
  };
};

// Coarse UTC day boundary for a YYYY-MM-DD key, consistent with how weekly
// windows compare date keys elsewhere in this service. Precise enough for
// occurrence-based pattern aggregation over a window.
const dateKeyToBoundaryDate = (
  dateKey: string | null,
  boundary: "start" | "end"
): Date | null => {
  if (!dateKey) {
    return null;
  }
  return new Date(
    `${dateKey}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}Z`
  );
};

// Load + rank the recurring patterns for a window from persisted per-entry
// insights. Best-effort: a failure just yields an empty patterns list so the
// Mind Map still renders its region scores.
const loadMindMapPatterns = async ({
  userId,
  startDate,
  endDate,
}: {
  userId: string;
  startDate?: Date | null;
  endDate?: Date | null;
}): Promise<InsightsMindMapPattern[]> => {
  try {
    const insights = await loadEntryInsights({
      userId,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    });
    return aggregateRecurringPatterns(insights, 5);
  } catch (error) {
    console.error("Failed to load Mind Map patterns:", error);
    return [];
  }
};

// Turns the user's own writing into one practical, supportive next step per
// region via a single structured call. Follows the AI contract: never throws,
// and every region is guaranteed a step — any region the model omits (or the
// whole map if AI is unavailable / returns null) falls back to the
// deterministic REFLECTION_REGION_FOCUS_TIPS. Callers only ever reach the ready
// path as premium + AI-opted-in users, but we still guard defensively.
const buildMindMapActionSteps = async ({
  userId,
  regions,
  combinedWriting,
}: {
  userId: string;
  regions: ReflectionRegionScore[];
  combinedWriting: string;
}): Promise<Map<ReflectionRegionId, string>> => {
  const steps = new Map<ReflectionRegionId, string>(
    REFLECTION_REGION_IDS.map((id) => [id, REFLECTION_REGION_FOCUS_TIPS[id]])
  );

  const writing = combinedWriting.trim();
  if (!writing || !(await canUseOpenAiForUser(userId))) {
    return steps;
  }

  const personalization = await buildUserPersonalization(userId);

  try {
    const result = await requestStructuredOpenAi({
      feature: "mind map action steps",
      schemaName: "mind_map_action_steps",
      schema: mindMapActionStepsJsonSchema,
      parser: mindMapActionStepsSchema,
      maxOutputTokens: 700,
      messages: [
        {
          role: "system",
          content: [
            "You write Journal.IO's per-region action steps for a reflection Mind Map. For each of the 8 regions, suggest ONE practical, rational next step the user could try, grounded in their own writing. Keep each step to a single short sentence a person could act on this week. Stay non-clinical, supportive, and uncertainty-aware: offer something to try, never a directive, prescription, or diagnosis. Avoid clinical or therapy jargon. Return a step for every region id provided.",
            personalization?.systemDirective,
            AI_ACTION_BALANCE_GUIDANCE,
          ]
            .filter(Boolean)
            .join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            userProfile: personalization?.promptProfile ?? null,
            regionIds: REFLECTION_REGION_IDS,
            regions: regions.map((region) => ({
              id: region.id,
              productName: region.productName,
              signalScore: region.score,
              intensity: region.intensity,
              evidence: region.evidence,
            })),
            writingExcerpt: writing.slice(0, 2600),
          }),
        },
      ],
    });

    if (result) {
      for (const step of result.steps) {
        const trimmed = step.actionStep.trim();
        if (trimmed) {
          steps.set(step.regionId, trimmed);
        }
      }
    }
  } catch (error) {
    console.error("Failed to build Mind Map action steps:", error);
  }

  return steps;
};

const buildLatestWeekMindMapCacheKey = ({
  window,
  timeZone,
  status,
}: {
  window: WeeklyWindowSnapshot;
  timeZone: string;
  status: InsightsMindMapResponse["status"];
}) =>
  `latest_week:${window.startDateKey}:${window.endDateKey}:${timeZone}:v${MIND_MAP_SCORER_VERSION}:${status}`;

const buildAllTimeMindMapCacheKey = ({
  timeZone,
  status,
}: {
  timeZone: string;
  status: InsightsMindMapResponse["status"];
}) => `all_time:${timeZone}:v${MIND_MAP_SCORER_VERSION}:${status}`;

const refreshLatestWeekMindMapCache = async ({
  userId,
  insights,
  timeZone,
  today,
}: {
  userId: string;
  insights: IInsights;
  timeZone: string;
  today: Date;
}) => {
  const { anchorDateKey } = await getAiAnalysisUserContext({
    userId,
    timeZone,
  });
  const todayDateKey = getLocalDateKey(today, timeZone);
  const currentWindowIndex = Math.floor(
    daysBetweenDateKeys(anchorDateKey, todayDateKey) / AI_ANALYSIS_WINDOW_DAYS
  );

  if (currentWindowIndex <= 0) {
    const currentWindow = resolveWeeklyWindow({
      anchorDateKey,
      windowIndex: 0,
      timeZone,
    });
    const currentSnapshots = toMindMapJournalSnapshots(
      analyzeWeeklyJournals(
        (await loadWindowSnapshots({ userId, window: currentWindow })).journals
      )
    );
    const clearEntryCount = getClearMindMapJournals(currentSnapshots).length;
    const totalWords = currentSnapshots.reduce(
      (sum, journal) => sum + journal.analysisWordCount,
      0
    );
    const progress = buildProgressSnapshot({
      window: buildWindowFromJournals({
        journals: currentSnapshots,
        window: currentWindow,
      }),
      activeDays: countActiveWritingDays(currentSnapshots, timeZone),
      entryCount: currentSnapshots.length,
      todayDateKey,
      promptState:
        currentSnapshots.length <= 0
          ? "zero_entries"
          : countActiveWritingDays(currentSnapshots, timeZone) >=
            MIND_MAP_MIN_ACTIVE_DAYS - 1
          ? "almost_ready"
          : "building",
    });
    const collecting = buildCollectingAiAnalysis({
      window: buildWindowFromJournals({
        journals: currentSnapshots,
        window: currentWindow,
      }),
      progress,
    });
    const period = buildMindMapPeriod({
      range: "latest_week",
      label: currentWindow.label,
      startDate: currentWindow.startDateKey,
      endDate: currentWindow.endDateKey,
      journals: currentSnapshots,
      clearEntryCount,
      totalWords,
      timeZone,
      generatedAt: null,
    });

    if (
      mindMapForceReady(clearEntryCount) &&
      !currentSnapshots.some((journal) =>
        hasJournalSafetySignal(journal.safetySignal)
      )
    ) {
      const { regions, regionMeans, combinedWriting } =
        await buildMindMapRegions({
          journals: currentSnapshots,
          activeDays: progress.activeDays,
        });
      const trends = await buildRegionTrendMap({ userId });
      const patterns = await loadMindMapPatterns({
        userId,
        startDate: dateKeyToBoundaryDate(currentWindow.startDateKey, "start"),
        endDate: dateKeyToBoundaryDate(currentWindow.endDateKey, "end"),
      });
      const actionSteps = await buildMindMapActionSteps({
        userId,
        regions,
        combinedWriting,
      });
      const generatedAt = new Date();
      const response = buildMindMapReadyResponse({
        range: "latest_week",
        period: { ...period, generatedAt: generatedAt.toISOString() },
        regions,
        regionMeans,
        trends,
        patterns,
        actionSteps,
      });

      return response;
    }

    return buildMindMapBuildingResponse({
      period,
      summary: {
        headline: collecting.summary.headline,
        narrative: collecting.summary.narrative,
        note: collecting.summary.highlight,
      },
      activeDays: progress.activeDays,
      clearEntryCount,
      daysRemaining: progress.daysRemaining,
    });
  }

  const closedWindow = resolveWeeklyWindow({
    anchorDateKey,
    windowIndex: Math.max(0, currentWindowIndex - 1),
    timeZone,
  });
  const journals = toMindMapJournalSnapshots(
    analyzeWeeklyJournals(
      (await loadWindowSnapshots({ userId, window: closedWindow })).journals
    )
  );
  const activeDays = countActiveWritingDays(journals, timeZone);
  const clearJournals = getClearMindMapJournals(journals);
  const clearEntryCount = clearJournals.length;
  const totalWords = clearJournals.reduce(
    (sum, journal) => sum + journal.analysisWordCount,
    0
  );
  const period = buildMindMapPeriod({
    range: "latest_week",
    label: closedWindow.label,
    startDate: closedWindow.startDateKey,
    endDate: closedWindow.endDateKey,
    journals,
    clearEntryCount,
    totalWords,
    timeZone,
    generatedAt: new Date(),
  });

  let response: InsightsMindMapResponse;

  if (
    journals.some((journal) => hasJournalSafetySignal(journal.safetySignal))
  ) {
    response = buildMindMapSupportFirstResponse({
      period,
      summary: {
        headline: "This week needs a support-first read",
        narrative:
          "Journal.IO noticed elevated-risk language in the latest closed premium week, so the Mind Map is paused instead of ranking reflection regions.",
        note: "Support-first handling takes priority over pattern scoring in this view.",
      },
      support: {
        headline:
          "A calmer next step matters more than a ranked map right now.",
        body: "If this writing reflects immediate risk or feeling unsafe, please reach out to local emergency or crisis support now.",
        note: "Journal.IO hides normal region scoring for safety-sensitive weekly writing.",
      },
    });
  } else if (
    !mindMapForceReady(clearEntryCount) &&
    (activeDays < MIND_MAP_MIN_ACTIVE_DAYS ||
      clearEntryCount < MIND_MAP_MIN_CLEAR_ENTRIES ||
      totalWords < MIND_MAP_MIN_CLEAR_WORDS)
  ) {
    const nextWindow = resolveWeeklyWindow({
      anchorDateKey,
      windowIndex: currentWindowIndex,
      timeZone,
    });
    const insufficient = buildInsufficientAiAnalysis({
      window: buildWindowFromJournals({ journals, window: closedWindow }),
      progress: {
        ...buildProgressSnapshot({
          window: buildWindowFromJournals({ journals, window: closedWindow }),
          activeDays,
          entryCount: journals.length,
          todayDateKey: closedWindow.endDateKey,
          promptState: "missed",
        }),
        nextWindowStartDate: nextWindow.startDateKey,
        nextWindowEndDate: nextWindow.endDateKey,
        nextWindowLabel: nextWindow.label,
      },
    });
    response = buildMindMapBuildingResponse({
      period,
      summary: {
        headline: insufficient.summary.headline,
        narrative: insufficient.summary.narrative,
        note: insufficient.summary.highlight,
      },
      activeDays,
      clearEntryCount,
      daysRemaining: null,
    });
  } else {
    const { regions, regionMeans, combinedWriting } = await buildMindMapRegions(
      {
        journals,
        activeDays,
      }
    );
    const trends = await buildRegionTrendMap({ userId });
    const patterns = await loadMindMapPatterns({
      userId,
      startDate: dateKeyToBoundaryDate(closedWindow.startDateKey, "start"),
      endDate: dateKeyToBoundaryDate(closedWindow.endDateKey, "end"),
    });
    const actionSteps = await buildMindMapActionSteps({
      userId,
      regions,
      combinedWriting,
    });
    response = buildMindMapReadyResponse({
      range: "latest_week",
      period,
      regions,
      regionMeans,
      trends,
      patterns,
      actionSteps,
    });
  }

  setEncryptedInsightsPayload(insights, "mindMapLatestWeek", response);
  insights.mindMapLatestWeekStale = false;
  insights.mindMapLatestWeekComputedAt = new Date();
  insights.mindMapLatestWeekCacheKey = buildLatestWeekMindMapCacheKey({
    window: closedWindow,
    timeZone,
    status: response.status,
  });
  await insights.save();

  return {
    ...response,
    period: {
      ...response.period,
      generatedAt: insights.mindMapLatestWeekComputedAt?.toISOString() || null,
    },
  } as InsightsMindMapResponse;
};

const refreshAllTimeMindMapCache = async ({
  userId,
  insights,
  timeZone,
}: {
  userId: string;
  insights: IInsights;
  timeZone: string;
}) => {
  const journals = toMindMapJournalSnapshots(
    analyzeWeeklyJournals(
      (
        await journalModel
          .find({ userId })
          .sort({ createdAt: -1 })
          .select("content aiPrompt tags isFavorite createdAt")
          .lean()
          .exec()
      ).map(toWeeklyJournalSnapshot)
    )
  );
  const safeJournals = journals.filter(
    (journal) => !hasJournalSafetySignal(journal.safetySignal)
  );
  const clearJournals = getClearMindMapJournals(safeJournals);
  const totalWords = clearJournals.reduce(
    (sum, journal) => sum + journal.analysisWordCount,
    0
  );
  const period = buildMindMapPeriod({
    range: "all_time",
    label: "All reflections",
    startDate: safeJournals.length
      ? safeJournals[safeJournals.length - 1]?.createdAt
          .toISOString()
          .slice(0, 10) || null
      : null,
    endDate: safeJournals[0]?.createdAt.toISOString().slice(0, 10) || null,
    journals: safeJournals,
    clearEntryCount: clearJournals.length,
    totalWords,
    timeZone,
    generatedAt: new Date(),
  });
  const activeDays = countActiveWritingDays(safeJournals, timeZone);
  let response: InsightsMindMapResponse;

  if (
    !safeJournals.length &&
    journals.some((journal) => hasJournalSafetySignal(journal.safetySignal))
  ) {
    response = buildMindMapSupportFirstResponse({
      period,
      summary: {
        headline: "Your map is paused for support-first handling",
        narrative:
          "Journal.IO excluded safety-sensitive writing from the all-reflections map, and there is not enough remaining safe writing to score regions yet.",
        note: "Support-first handling takes priority over ranking reflection regions.",
      },
      support: {
        headline: "This history needs a support-first response first.",
        body: "If your recent writing reflects immediate risk or feeling unsafe, please reach out to local emergency or crisis support now.",
        note: "Once there is enough safe writing to map, the all-reflections view can return without surfacing sensitive text.",
      },
    });
  } else if (
    !mindMapForceReady(clearJournals.length) &&
    clearJournals.length < MIND_MAP_MIN_ENTRIES
  ) {
    response = buildMindMapBuildingResponse({
      period,
      summary: {
        headline: "Your Mind Map is still building",
        narrative: `Journal.IO needs a few more clear entries (about ${MIND_MAP_MIN_ENTRIES}) before it can rank reflection regions across all reflections.`,
        note: "Keep adding honest entries in your own words and the map will fill in without inventing activity.",
      },
      activeDays,
      clearEntryCount: clearJournals.length,
      daysRemaining: null,
      minimumEntries: MIND_MAP_MIN_ENTRIES,
    });
  } else {
    const { regions, regionMeans, combinedWriting } = await buildMindMapRegions(
      {
        journals: safeJournals,
        activeDays,
      }
    );
    const trends = await buildRegionTrendMap({ userId });
    const patterns = await loadMindMapPatterns({ userId });
    const actionSteps = await buildMindMapActionSteps({
      userId,
      regions,
      combinedWriting,
    });
    response = buildMindMapReadyResponse({
      range: "all_time",
      period,
      regions,
      regionMeans,
      trends,
      patterns,
      actionSteps,
    });
  }

  setEncryptedInsightsPayload(insights, "mindMapAllTime", response);
  insights.mindMapAllTimeStale = false;
  insights.mindMapAllTimeComputedAt = new Date();
  insights.mindMapAllTimeCacheKey = buildAllTimeMindMapCacheKey({
    timeZone,
    status: response.status,
  });
  await insights.save();

  return {
    ...response,
    period: {
      ...response.period,
      generatedAt: insights.mindMapAllTimeComputedAt?.toISOString() || null,
    },
  } as InsightsMindMapResponse;
};

const buildMonthlyMindMapCacheKey = ({
  todayDateKey,
  timeZone,
  status,
}: {
  todayDateKey: string;
  timeZone: string;
  status: InsightsMindMapResponse["status"];
}) =>
  `monthly:${todayDateKey}:${timeZone}:v${MIND_MAP_SCORER_VERSION}:${status}`;

// Current calendar-month Mind Map (resets each month, not a rolling window).
// Reuses the same region aggregation, trend, and pattern machinery as the other
// windows, just filtered to the month-to-date range.
const refreshMonthlyMindMapCache = async ({
  userId,
  insights,
  timeZone,
  today,
}: {
  userId: string;
  insights: IInsights;
  timeZone: string;
  today: Date;
}) => {
  const endDate = today;
  const todayDateKey = getLocalDateKey(today, timeZone);
  const monthStartDateKey = `${todayDateKey.slice(0, 7)}-01`;
  const startDate = getUtcStartForDateKey(monthStartDateKey, timeZone);
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone,
  }).format(getUtcStartForDateKey(monthStartDateKey, timeZone));

  const journals = toMindMapJournalSnapshots(
    analyzeWeeklyJournals(
      (
        await journalModel
          .find({ userId, createdAt: { $gte: startDate, $lte: endDate } })
          .sort({ createdAt: -1 })
          .select("content aiPrompt tags isFavorite createdAt")
          .lean()
          .exec()
      ).map(toWeeklyJournalSnapshot)
    )
  );
  const safeJournals = journals.filter(
    (journal) => !hasJournalSafetySignal(journal.safetySignal)
  );
  const clearJournals = getClearMindMapJournals(safeJournals);
  const totalWords = clearJournals.reduce(
    (sum, journal) => sum + journal.analysisWordCount,
    0
  );
  const activeDays = countActiveWritingDays(safeJournals, timeZone);
  const period = buildMindMapPeriod({
    range: "monthly",
    label: monthLabel,
    startDate: getLocalDateKey(startDate, timeZone),
    endDate: getLocalDateKey(endDate, timeZone),
    journals: safeJournals,
    clearEntryCount: clearJournals.length,
    totalWords,
    timeZone,
    generatedAt: new Date(),
  });

  let response: InsightsMindMapResponse;

  if (
    !safeJournals.length &&
    journals.some((journal) => hasJournalSafetySignal(journal.safetySignal))
  ) {
    response = buildMindMapSupportFirstResponse({
      period,
      summary: {
        headline: "This month is paused for support-first handling",
        narrative:
          "Journal.IO excluded safety-sensitive writing from this month's map, and there is not enough remaining safe writing to score regions yet.",
        note: "Support-first handling takes priority over ranking reflection regions.",
      },
      support: {
        headline: "This month needs a support-first response first.",
        body: "If your recent writing reflects immediate risk or feeling unsafe, please reach out to local emergency or crisis support now.",
        note: "Once there is enough safe writing to map, this month's view can return without surfacing sensitive text.",
      },
    });
  } else if (
    !mindMapForceReady(clearJournals.length) &&
    (activeDays < MIND_MAP_MIN_ACTIVE_DAYS ||
      clearJournals.length < MIND_MAP_MIN_CLEAR_ENTRIES ||
      totalWords < MIND_MAP_MIN_CLEAR_WORDS)
  ) {
    response = buildMindMapBuildingResponse({
      period,
      summary: {
        headline: "Your Mind Map is still building",
        narrative: `A few active writing days this month let Journal.IO see steady patterns instead of a single moment — so the map reflects how you actually reflect, not one entry.`,
        note: "Keep adding honest entries in your own words and this month's map will fill in without inventing activity.",
      },
      activeDays,
      clearEntryCount: clearJournals.length,
      daysRemaining: null,
    });
  } else {
    const { regions, regionMeans, combinedWriting } = await buildMindMapRegions(
      {
        journals: safeJournals,
        activeDays,
      }
    );
    const trends = await buildRegionTrendMap({ userId, startDate, endDate });
    const patterns = await loadMindMapPatterns({ userId, startDate, endDate });
    const actionSteps = await buildMindMapActionSteps({
      userId,
      regions,
      combinedWriting,
    });
    response = buildMindMapReadyResponse({
      range: "monthly",
      period,
      regions,
      regionMeans,
      trends,
      patterns,
      actionSteps,
    });
  }

  setEncryptedInsightsPayload(insights, "mindMapMonthly", response);
  insights.mindMapMonthlyStale = false;
  insights.mindMapMonthlyComputedAt = new Date();
  insights.mindMapMonthlyCacheKey = buildMonthlyMindMapCacheKey({
    todayDateKey: getLocalDateKey(today, timeZone),
    timeZone,
    status: response.status,
  });
  await insights.save();

  return {
    ...response,
    period: {
      ...response.period,
      generatedAt: insights.mindMapMonthlyComputedAt?.toISOString() || null,
    },
  } as InsightsMindMapResponse;
};

const rebuildInsightsCache = async (userId: string) => {
  const [journals, moodCheckIns] = await Promise.all([
    journalModel
      .find({ userId })
      .select("content tags detectedTopics isFavorite createdAt")
      .lean()
      .exec(),
    moodCheckInModel.find({ userId }).select("mood").lean().exec(),
  ]);

  const dailyJournalCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const moodCounts = readMoodCountMap();
  let totalEntries = 0;
  let totalWords = 0;
  let totalFavorites = 0;

  for (const journal of journals) {
    const decryptedJournal = decryptInsightJournalRow(journal);

    totalEntries += 1;
    totalWords += countWords(
      typeof decryptedJournal.content === "string"
        ? decryptedJournal.content
        : ""
    );
    totalFavorites += decryptedJournal.isFavorite ? 1 : 0;

    updateCountMapValue(
      dailyJournalCounts,
      getDateKey(decryptedJournal.createdAt),
      1
    );

    for (const tag of normalizeInsightTags([
      ...(Array.isArray(decryptedJournal.tags) ? decryptedJournal.tags : []),
      ...(Array.isArray(decryptedJournal.detectedTopics)
        ? decryptedJournal.detectedTopics
        : []),
    ])) {
      updateCountMapValue(tagCounts, tag, 1);
    }
  }

  for (const moodCheckIn of moodCheckIns) {
    if (MOOD_ORDER.includes(moodCheckIn.mood)) {
      updateMoodMapValue(moodCounts, moodCheckIn.mood, 1);
    }
  }

  const insights =
    (await insightsModel.findOne({ userId }).exec()) ||
    new insightsModel({ userId });

  insights.totalEntries = totalEntries;
  insights.totalWords = totalWords;
  insights.totalFavorites = totalFavorites;
  insights.dailyJournalCounts = dailyJournalCounts;
  setEncryptedInsightsTagCounts(insights, tagCounts);
  insights.moodCounts = moodCounts;
  insights.lastJournalDateKey = getLatestJournalDateKey(dailyJournalCounts);
  insights.lastCalculatedAt = new Date();
  setEncryptedInsightsPayload(insights, "aiAnalysis", null);
  insights.aiAnalysisStale = true;
  insights.aiAnalysisComputedAt = null;
  insights.aiAnalysisWindowEndDateKey = null;
  insights.aiAnalysisCacheKey = null;
  setEncryptedInsightsPayload(insights, "mindMapLatestWeek", null);
  insights.mindMapLatestWeekStale = true;
  insights.mindMapLatestWeekComputedAt = null;
  insights.mindMapLatestWeekCacheKey = null;
  setEncryptedInsightsPayload(insights, "mindMapMonthly", null);
  insights.mindMapMonthlyStale = true;
  insights.mindMapMonthlyComputedAt = null;
  insights.mindMapMonthlyCacheKey = null;
  setEncryptedInsightsPayload(insights, "mindMapAllTime", null);
  insights.mindMapAllTimeStale = true;
  insights.mindMapAllTimeComputedAt = null;
  insights.mindMapAllTimeCacheKey = null;

  await insights.save();

  return insights;
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

const markMindMapStale = (insights: IInsights) => {
  insights.mindMapLatestWeekStale = true;
  insights.mindMapLatestWeekCacheKey = null;
  insights.mindMapMonthlyStale = true;
  insights.mindMapMonthlyCacheKey = null;
  insights.mindMapAllTimeStale = true;
  insights.mindMapAllTimeCacheKey = null;
};

const applyInsightsDocument = async (
  userId: string,
  updater: (insights: IInsights) => void
) => {
  const insights = await insightsModel.findOne({ userId }).exec();

  if (!insights) {
    await rebuildInsightsCache(userId);
    return;
  }

  updater(insights);
  insights.lastCalculatedAt = new Date();
  await insights.save();
};

/**
 * Invalidate a user's Mind Map caches so the next read recomputes. Used by the
 * per-entry background AI scorer once a stored score is upgraded to AI, so the
 * global map reflects the AI signal on its next read.
 */
const markUserMindMapStale = async (userId: string) => {
  await applyInsightsDocument(userId, markMindMapStale);
};

const syncJournalCreatedInsights = async (journal: JournalInsightsSnapshot) => {
  await applyInsightsDocument(journal.userId, (insights) => {
    const dailyJournalCounts = readCountMap(insights.dailyJournalCounts);
    const tagCounts = readCountMap(insights.tagCounts);
    const dateKey = getDateKey(journal.createdAt);

    insights.totalEntries = Number(insights.totalEntries || 0) + 1;
    insights.totalWords =
      Number(insights.totalWords || 0) + countWords(journal.content);
    insights.totalFavorites =
      Number(insights.totalFavorites || 0) + (journal.isFavorite ? 1 : 0);

    updateCountMapValue(dailyJournalCounts, dateKey, 1);

    for (const tag of normalizeInsightTags(journal.tags)) {
      updateCountMapValue(tagCounts, tag, 1);
    }

    insights.dailyJournalCounts = dailyJournalCounts;
    setEncryptedInsightsTagCounts(insights, tagCounts);
    insights.lastJournalDateKey = getLatestJournalDateKey(dailyJournalCounts);
    markAiAnalysisStale(insights);
    markMindMapStale(insights);
  });
};

const syncJournalUpdatedInsights = async ({
  previousJournal,
  nextJournal,
}: {
  previousJournal: JournalInsightsSnapshot;
  nextJournal: JournalInsightsSnapshot;
}) => {
  await applyInsightsDocument(previousJournal.userId, (insights) => {
    const dailyJournalCounts = readCountMap(insights.dailyJournalCounts);
    const tagCounts = readCountMap(insights.tagCounts);
    const previousDateKey = getDateKey(previousJournal.createdAt);
    const nextDateKey = getDateKey(nextJournal.createdAt);

    insights.totalWords =
      Number(insights.totalWords || 0) -
      countWords(previousJournal.content) +
      countWords(nextJournal.content);
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
    setEncryptedInsightsTagCounts(insights, tagCounts);
    insights.lastJournalDateKey = getLatestJournalDateKey(dailyJournalCounts);
    markAiAnalysisStale(insights);
    markMindMapStale(insights);
  });
};

const syncJournalDeletedInsights = async (journal: JournalInsightsSnapshot) => {
  await applyInsightsDocument(journal.userId, (insights) => {
    const dailyJournalCounts = readCountMap(insights.dailyJournalCounts);
    const tagCounts = readCountMap(insights.tagCounts);
    const dateKey = getDateKey(journal.createdAt);

    insights.totalEntries = Math.max(0, Number(insights.totalEntries || 0) - 1);
    insights.totalWords = Math.max(
      0,
      Number(insights.totalWords || 0) - countWords(journal.content)
    );
    insights.totalFavorites = Math.max(
      0,
      Number(insights.totalFavorites || 0) - (journal.isFavorite ? 1 : 0)
    );

    updateCountMapValue(dailyJournalCounts, dateKey, -1);

    for (const tag of normalizeInsightTags(journal.tags)) {
      updateCountMapValue(tagCounts, tag, -1);
    }

    insights.dailyJournalCounts = dailyJournalCounts;
    setEncryptedInsightsTagCounts(insights, tagCounts);
    insights.lastJournalDateKey = getLatestJournalDateKey(dailyJournalCounts);
    markAiAnalysisStale(insights);
    markMindMapStale(insights);
  });
};

const syncMoodLoggedInsights = async (moodCheckIn: MoodInsightsSnapshot) => {
  await applyInsightsDocument(moodCheckIn.userId, (insights) => {
    const moodCounts = readMoodCountMap(insights.moodCounts);
    updateMoodMapValue(moodCounts, moodCheckIn.mood, 1);
    insights.moodCounts = moodCounts;
    markAiAnalysisStale(insights);
  });
};

const getInsightsOverview = async (
  userId: string
): Promise<InsightsOverviewResponse> => {
  const insights = await getOrBuildInsightsCache(userId);

  if (!insights) {
    const rebuiltInsights = await rebuildInsightsCache(userId);

    if (!rebuiltInsights) {
      throw new Error("We couldn't load your insights right now.");
    }

    return toInsightsOverview(rebuiltInsights);
  }

  return toInsightsOverview(insights);
};

// Bump when the weekly AI-analysis payload shape changes so stale caches from a
// prior shape are recomputed. v2: behavioural patterns replace Big Five / dark
// triad, and pattern material now feeds the weekly enhancement. v3: ready-state
// summary drops `highlight` (folded into `narrative`, including the safety-path
// crisis line), `patterns` capped at 3 (was 4), `actionPlan.steps` fixed at 2
// (was 3) — mirrors the collapsed 4-card mobile Analysis tab.
const WEEKLY_AI_ANALYSIS_VERSION = 3;
const buildAiAnalysisCacheKey = ({
  window,
  status,
}: {
  window: WeeklyWindowSnapshot;
  status: "ready" | "insufficient";
}) =>
  `${window.startDateKey}:${window.endDateKey}:${window.timeZone}:${status}:v${WEEKLY_AI_ANALYSIS_VERSION}`;

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

    setEncryptedInsightsPayload(insights, "aiAnalysis", insufficientAnalysis);
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
    analysis.freshness.note = `Development override is showing this AI analysis before the normal 4 active-day minimum is met. ${analysis.freshness.note}`;
  }

  setEncryptedInsightsPayload(insights, "aiAnalysis", analysis);
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
    throw new Error("We couldn't load your AI analysis right now.");
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

  const { anchorDateKey } = await getAiAnalysisUserContext({
    userId,
    timeZone,
  });
  const todayDateKey = getLocalDateKey(today, timeZone);
  const currentWindowIndex = Math.floor(
    daysBetweenDateKeys(anchorDateKey, todayDateKey) / AI_ANALYSIS_WINDOW_DAYS
  );
  const closedWindow = resolveWeeklyWindow({
    anchorDateKey,
    windowIndex: Math.max(0, currentWindowIndex - 1),
    timeZone,
  });
  const cachedAnalysis =
    insights.aiAnalysis as InsightsAiAnalysisResponse | null;
  const cachedStatus =
    cachedAnalysis?.status === "ready" ||
    cachedAnalysis?.status === "insufficient"
      ? cachedAnalysis.status
      : null;
  const cachedEarlyReadyPreview =
    cachedAnalysis?.status === "ready" &&
    cachedAnalysis.window.activeDays < AI_ANALYSIS_MIN_ACTIVE_DAYS &&
    cachedAnalysis.freshness.confidenceLabel === "Dev preview";

  if (
    cachedAnalysis &&
    cachedStatus &&
    (allowEarlyReady || !cachedEarlyReadyPreview) &&
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

const getInsightsMindMap = async (
  userId: string,
  options: {
    range: InsightsMindMapRange;
    timeZone?: string;
    today?: Date;
  }
): Promise<InsightsMindMapResponse> => {
  await ensureAiAnalysisEnabled(userId);

  const insights = await getOrBuildInsightsCache(userId);

  if (!insights) {
    throw new Error("We couldn't load your Mind Map right now.");
  }

  const timeZone = normalizeTimeZone(options.timeZone);
  const today = options.today || new Date();

  if (options.range === "all_time") {
    const cachedAllTime =
      insights.mindMapAllTime as InsightsMindMapResponse | null;

    if (
      !MIND_MAP_RELAX_THRESHOLDS &&
      cachedAllTime &&
      !insights.mindMapAllTimeStale &&
      insights.mindMapAllTimeCacheKey ===
        buildAllTimeMindMapCacheKey({
          timeZone,
          status: cachedAllTime.status,
        })
    ) {
      return cachedAllTime;
    }

    return refreshAllTimeMindMapCache({
      userId,
      insights,
      timeZone,
    });
  }

  if (options.range === "monthly") {
    const cachedMonthly =
      insights.mindMapMonthly as InsightsMindMapResponse | null;

    if (
      !MIND_MAP_RELAX_THRESHOLDS &&
      cachedMonthly &&
      !insights.mindMapMonthlyStale &&
      insights.mindMapMonthlyCacheKey ===
        buildMonthlyMindMapCacheKey({
          todayDateKey: getLocalDateKey(today, timeZone),
          timeZone,
          status: cachedMonthly.status,
        })
    ) {
      return cachedMonthly;
    }

    return refreshMonthlyMindMapCache({
      userId,
      insights,
      timeZone,
      today,
    });
  }

  const { anchorDateKey } = await getAiAnalysisUserContext({
    userId,
    timeZone,
  });
  const todayDateKey = getLocalDateKey(today, timeZone);
  const currentWindowIndex = Math.floor(
    daysBetweenDateKeys(anchorDateKey, todayDateKey) / AI_ANALYSIS_WINDOW_DAYS
  );

  if (currentWindowIndex > 0) {
    const closedWindow = resolveWeeklyWindow({
      anchorDateKey,
      windowIndex: Math.max(0, currentWindowIndex - 1),
      timeZone,
    });
    const cachedLatestWeek =
      insights.mindMapLatestWeek as InsightsMindMapResponse | null;

    if (
      !MIND_MAP_RELAX_THRESHOLDS &&
      cachedLatestWeek &&
      !insights.mindMapLatestWeekStale &&
      insights.mindMapLatestWeekCacheKey ===
        buildLatestWeekMindMapCacheKey({
          window: closedWindow,
          timeZone,
          status: cachedLatestWeek.status,
        })
    ) {
      return cachedLatestWeek;
    }
  }

  return refreshLatestWeekMindMapCache({
    userId,
    insights,
    timeZone,
    today,
  });
};

const REGION_SERIES_DAY_LABEL_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const REGION_SERIES_MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

const regionSeriesLabel = (
  dateKey: string,
  bucket: "day" | "week" | "month"
) => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return bucket === "month"
    ? REGION_SERIES_MONTH_LABEL_FORMAT.format(date)
    : REGION_SERIES_DAY_LABEL_FORMAT.format(date);
};

// Development graph for a single region across a range. Reads the persisted
// per-entry scores directly (no OpenAI call), bucketed by day for recent
// windows and by week for all-time so the line stays readable.
const getInsightsMindMapRegionSeries = async (
  userId: string,
  options: {
    regionId: ReflectionRegionId;
    range: InsightsMindMapRange;
    timeZone?: string;
    today?: Date;
  }
): Promise<InsightsRegionSeriesResponse> => {
  await ensureAiAnalysisEnabled(userId);

  const timeZone = normalizeTimeZone(options.timeZone);
  const today = options.today || new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  let startDate: Date | null = null;
  // "auto" lets the series pick day/week/month from the data span so a longer
  // history stays detailed but readable; bounded ranges stay by-day.
  let requestedBucket: "day" | "auto" = "auto";

  if (options.range === "all_time") {
    startDate = null;
    requestedBucket = "auto";
  } else if (options.range === "monthly") {
    // Current calendar month (month-to-date), matching the aggregate window.
    const monthStartDateKey = `${getLocalDateKey(today, timeZone).slice(
      0,
      7
    )}-01`;
    startDate = getUtcStartForDateKey(monthStartDateKey, timeZone);
    requestedBucket = "day";
  } else {
    startDate = new Date(
      today.getTime() - (AI_ANALYSIS_WINDOW_DAYS - 1) * dayMs
    );
    requestedBucket = "day";
  }

  const { bucket, points } = await buildRegionTimeSeries({
    userId,
    regionId: options.regionId,
    startDate,
    endDate: today,
    bucket: requestedBucket,
  });

  return {
    regionId: options.regionId,
    productLabel: REFLECTION_REGION_DETAILS[options.regionId].productName,
    brainRegionSubtitle:
      REFLECTION_REGION_DETAILS[options.regionId].brainRegion,
    range: options.range,
    bucket,
    startDate: startDate ? getLocalDateKey(startDate, timeZone) : null,
    endDate: getLocalDateKey(today, timeZone),
    points: points.map((point) => ({
      dateKey: point.dateKey,
      label: regionSeriesLabel(point.dateKey, bucket),
      value: point.value,
    })),
  };
};

export {
  PremiumFeatureRequiredError,
  buildWeeklyAiAnalysis,
  getInsightsOverview,
  getInsightsAiAnalysis,
  getInsightsMindMap,
  getInsightsMindMapRegionSeries,
  markUserMindMapStale,
  mergeAiAnalysisEnhancement,
  rebuildInsightsCache,
  syncJournalCreatedInsights,
  syncJournalDeletedInsights,
  syncJournalUpdatedInsights,
  syncMoodLoggedInsights,
};
