import { request } from "../utils/apiClient";
import type { BrainReflectionCenterId } from "./guidedReflectionService";

type InsightMood = "amazing" | "good" | "okay" | "bad" | "terrible";
type InsightTone = "coral" | "blue" | "sage" | "amber" | "slate";

type InsightsAiAnalysisWindow = {
  startDate: string;
  endDate: string;
  label: string;
  entryCount: number;
  activeDays: number;
  totalWords: number;
  minimumActiveDays: number;
};

type InsightsAiAnalysisProgress = {
  currentDayOfWindow: number;
  daysRemaining: number;
  minimumActiveDays: number;
  activeDays: number;
  entriesNeeded: number;
  completionPercentage: number;
  promptState: "zero_entries" | "building" | "almost_ready" | "missed";
};

type InsightsAiAnalysisSummary = {
  headline: string;
  narrative: string;
  highlight: string;
};

type InsightsAiAnalysisQuickAnalysis = {
  available: boolean;
  title: string;
  description: string;
};

type InsightsOverview = {
  stats: {
    totalEntries: number;
    currentStreak: number;
    averageWords: number;
    totalFavorites: number;
  };
  activity7d: {
    dateKey: string;
    label: string;
    count: number;
  }[];
  moodDistribution: {
    mood: InsightMood;
    label: string;
    count: number;
    percentage: number;
  }[];
  popularTopics: {
    tag: string;
    label: string;
    count: number;
    percentage: number;
  }[];
  analysis: {
    summary: string;
    keyInsight: string;
    growthPatterns: {
      title: string;
      subtitle: string;
    }[];
    personalizedPrompts: {
      topic: string;
      text: string;
    }[];
  };
  updatedAt: string | null;
};

type InsightsAiAnalysisCollecting = {
  status: "collecting";
  window: InsightsAiAnalysisWindow;
  progress: InsightsAiAnalysisProgress;
  summary: InsightsAiAnalysisSummary;
  quickAnalysis: InsightsAiAnalysisQuickAnalysis;
};

type InsightsAiAnalysisInsufficient = {
  status: "insufficient";
  window: InsightsAiAnalysisWindow;
  progress: InsightsAiAnalysisProgress & {
    nextWindowStartDate: string;
    nextWindowEndDate: string;
    nextWindowLabel: string;
  };
  summary: InsightsAiAnalysisSummary;
  quickAnalysis: InsightsAiAnalysisQuickAnalysis;
};

type InsightsAiAnalysisReady = {
  status: "ready";
  window: InsightsAiAnalysisWindow;
  freshness: {
    generatedAt: string | null;
    confidence: "low" | "medium" | "high";
    confidenceLabel: string;
    note: string;
  };
  summary: {
    headline: string;
    narrative: string;
  };
  patternTags: {
    label: string;
    tone: InsightTone;
  }[];
  scoreboard: {
    vibeLabel: string;
    vibeTone: InsightTone;
    cards: {
      key: "activeDays" | "entries" | "words" | "mood";
      label: string;
      value: string;
      tone: InsightTone;
    }[];
  };
  emotionTrend: {
    headline: string;
    days: {
      dateKey: string;
      label: string;
      moodLabel: string | null;
      moodScore: number | null;
      entryCount: number;
      tone: InsightTone;
    }[];
  };
  themeBreakdown: {
    headline: string;
    items: {
      label: string;
      count: number;
      percentage: number;
      tone: InsightTone;
    }[];
  };
  signals: {
    whatHelped: {
      title: string;
      description: string;
      evidence: string[];
      tone: InsightTone;
    }[];
    whatDrained: {
      title: string;
      description: string;
      evidence: string[];
      tone: InsightTone;
    }[];
    whatKeptShowingUp: {
      title: string;
      description: string;
      evidence: string[];
      tone: InsightTone;
    }[];
  };
  // Behavioural patterns the week surfaced (behaviour + trigger/feeling + gentle
  // nudge). Replaces the earlier Big Five / dark-triad personality framing.
  patterns: {
    label: string;
    insight: string;
    evidence: string[];
    nudge: string;
    tone: InsightTone;
  }[];
  actionPlan: {
    headline: string;
    steps: {
      title: string;
      description: string;
      focus: string;
    }[];
  };
  appSupport: {
    headline: string;
    items: {
      title: string;
      description: string;
    }[];
  };
};

type InsightsAiAnalysis =
  | InsightsAiAnalysisCollecting
  | InsightsAiAnalysisInsufficient
  | InsightsAiAnalysisReady;

type InsightsMindMapRange = "latest_week" | "monthly" | "all_time";

// A recurring theme aggregated across the window: what it is, why the AI
// concluded it, and the user's own supporting sentence.
type InsightsMindMapPattern = {
  id: string;
  label: string;
  rationale: string;
  evidenceQuote: string;
  occurrences: number;
  confidence: number;
};

type MindMapEntryPattern = {
  id: string;
  label: string;
  rationale: string;
  evidenceQuote: string;
  confidence: number;
};

type InsightsMindMapPeriod = {
  range: InsightsMindMapRange;
  label: string;
  startDate: string | null;
  endDate: string | null;
  entryCount: number;
  activeDays: number;
  clearEntryCount: number;
  totalWords: number;
  minimumActiveDays: number;
  generatedAt: string | null;
};

type InsightsMindMapSummary = {
  headline: string;
  narrative: string;
  note: string;
};

type InsightsMindMapDisclaimer = {
  title: string;
  body: string;
};

type MindMapRegionTrend = "rising" | "steady" | "easing";

type ReflectionRegionTier = "low" | "balanced" | "high" | "very_high";

type OverallReflectionTierId =
  | "emerging"
  | "balanced"
  | "deeply_reflective"
  | "highly_attuned";

type OverallReflectionTier = {
  tier: OverallReflectionTierId;
  label: string;
  blurb: string;
};

type InsightsMindMapRegion = {
  id: BrainReflectionCenterId;
  productLabel: string;
  brainRegionSubtitle: string;
  signalScore: number;
  confidence: number;
  rank: number;
  intensity: "low" | "moderate" | "high";
  shortInsight: string;
  actionStep: string;
  evidenceSnippets: string[];
  trend: MindMapRegionTrend;
  trendLabel: string;
  tier: ReflectionRegionTier;
  tierLabel: string;
};

type InsightsRegionSeriesPoint = {
  dateKey: string;
  label: string;
  value: number;
};

type InsightsRegionSeries = {
  regionId: BrainReflectionCenterId;
  productLabel: string;
  brainRegionSubtitle: string;
  range: InsightsMindMapRange;
  bucket: "day" | "week" | "month";
  startDate: string | null;
  endDate: string | null;
  points: InsightsRegionSeriesPoint[];
};

type InsightsMindMapFocus = {
  headline: string;
  body: string;
  regionId: BrainReflectionCenterId;
};

type InsightsMindMapReady = {
  status: "ready";
  period: InsightsMindMapPeriod;
  summary: InsightsMindMapSummary;
  strongestRegionId: BrainReflectionCenterId;
  patterns: InsightsMindMapPattern[];
  regions: InsightsMindMapRegion[];
  focus?: InsightsMindMapFocus;
  overallTier: OverallReflectionTier;
  disclaimer: InsightsMindMapDisclaimer;
};

type InsightsMindMapBuilding = {
  status: "building";
  period: InsightsMindMapPeriod;
  summary: InsightsMindMapSummary;
  progress: {
    activeDays: number;
    minimumActiveDays: number;
    clearEntryCount: number;
    entriesNeeded: number;
    daysRemaining: number | null;
  };
  disclaimer: InsightsMindMapDisclaimer;
};

type InsightsMindMapSupportFirst = {
  status: "support_first";
  period: InsightsMindMapPeriod;
  summary: InsightsMindMapSummary;
  support: {
    headline: string;
    body: string;
    note: string;
  };
  disclaimer: InsightsMindMapDisclaimer;
};

type InsightsMindMap =
  | InsightsMindMapReady
  | InsightsMindMapBuilding
  | InsightsMindMapSupportFirst;

type MindMapEntryRegion = {
  id: BrainReflectionCenterId;
  productLabel: string;
  brainRegionSubtitle: string;
  signalScore: number;
  confidence: number;
  rank: number;
  intensity: "low" | "moderate" | "high";
  shortInsight: string;
  evidenceSnippets: string[];
  tier: ReflectionRegionTier;
  tierLabel: string;
};

type MindMapEntryReady = {
  status: "ready";
  journalId: string;
  entryType: "open_ended" | "guided";
  source: "ai" | "heuristic";
  refining: boolean;
  strongestRegionId: BrainReflectionCenterId;
  patterns: MindMapEntryPattern[];
  regions: MindMapEntryRegion[];
  overallTier: OverallReflectionTier;
  summary: {
    headline: string;
    narrative: string;
    seedText: string;
  };
  disclaimer: InsightsMindMapDisclaimer;
};

type MindMapEntrySupportFirst = {
  status: "support_first";
  journalId: string;
  entryType: "open_ended" | "guided";
  support: {
    headline: string;
    body: string;
    note: string;
  };
  disclaimer: InsightsMindMapDisclaimer;
};

type MindMapEntry = MindMapEntryReady | MindMapEntrySupportFirst;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasCollectingShape(
  value: unknown
): value is Omit<InsightsAiAnalysisCollecting, "status"> {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRecord(value.window) &&
    isRecord(value.progress) &&
    isRecord(value.summary) &&
    isRecord(value.quickAnalysis)
  );
}

function hasInsufficientShape(
  value: unknown
): value is Omit<InsightsAiAnalysisInsufficient, "status"> {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRecord(value.window) &&
    isRecord(value.progress) &&
    isRecord(value.summary) &&
    isRecord(value.quickAnalysis)
  );
}

function hasReadyShape(value: unknown): value is Omit<InsightsAiAnalysisReady, "status"> {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRecord(value.window) &&
    isRecord(value.freshness) &&
    isRecord(value.summary) &&
    Array.isArray(value.patternTags) &&
    isRecord(value.scoreboard) &&
    isRecord(value.emotionTrend) &&
    isRecord(value.themeBreakdown) &&
    isRecord(value.signals) &&
    isRecord(value.actionPlan) &&
    isRecord(value.appSupport)
  );
}

function hasMindMapPeriodShape(value: unknown): value is InsightsMindMapPeriod {
  return (
    isRecord(value) &&
    typeof value.label === "string" &&
    typeof value.entryCount === "number" &&
    typeof value.activeDays === "number" &&
    typeof value.clearEntryCount === "number" &&
    typeof value.totalWords === "number"
  );
}

function hasMindMapSummaryShape(value: unknown): value is InsightsMindMapSummary {
  return (
    isRecord(value) &&
    typeof value.headline === "string" &&
    typeof value.narrative === "string" &&
    typeof value.note === "string"
  );
}

function hasMindMapDisclaimerShape(value: unknown): value is InsightsMindMapDisclaimer {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.body === "string"
  );
}

function hasMindMapRegionShape(value: unknown): value is InsightsMindMapRegion {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.productLabel === "string" &&
    typeof value.brainRegionSubtitle === "string" &&
    typeof value.signalScore === "number" &&
    typeof value.confidence === "number" &&
    typeof value.rank === "number" &&
    typeof value.shortInsight === "string" &&
    Array.isArray(value.evidenceSnippets)
  );
}

function hasMindMapReadyShape(value: unknown): value is Omit<InsightsMindMapReady, "status"> {
  return (
    isRecord(value) &&
    hasMindMapPeriodShape(value.period) &&
    hasMindMapSummaryShape(value.summary) &&
    typeof value.strongestRegionId === "string" &&
    Array.isArray(value.regions) &&
    value.regions.every(hasMindMapRegionShape) &&
    hasMindMapDisclaimerShape(value.disclaimer)
  );
}

function hasMindMapBuildingShape(
  value: unknown
): value is Omit<InsightsMindMapBuilding, "status"> {
  return (
    isRecord(value) &&
    hasMindMapPeriodShape(value.period) &&
    hasMindMapSummaryShape(value.summary) &&
    isRecord(value.progress) &&
    typeof value.progress.activeDays === "number" &&
    typeof value.progress.minimumActiveDays === "number" &&
    typeof value.progress.clearEntryCount === "number" &&
    typeof value.progress.entriesNeeded === "number" &&
    hasMindMapDisclaimerShape(value.disclaimer)
  );
}

function hasMindMapSupportFirstShape(
  value: unknown
): value is Omit<InsightsMindMapSupportFirst, "status"> {
  return (
    isRecord(value) &&
    hasMindMapPeriodShape(value.period) &&
    hasMindMapSummaryShape(value.summary) &&
    isRecord(value.support) &&
    typeof value.support.headline === "string" &&
    typeof value.support.body === "string" &&
    typeof value.support.note === "string" &&
    hasMindMapDisclaimerShape(value.disclaimer)
  );
}

function normalizeInsightsAiAnalysis(data: unknown): InsightsAiAnalysis {
  if (isRecord(data) && data.status === "collecting" && hasCollectingShape(data)) {
    return data as InsightsAiAnalysisCollecting;
  }

  if (isRecord(data) && data.status === "insufficient" && hasInsufficientShape(data)) {
    return data as InsightsAiAnalysisInsufficient;
  }

  if (isRecord(data) && data.status === "ready" && hasReadyShape(data)) {
    return data as InsightsAiAnalysisReady;
  }

  if (hasCollectingShape(data)) {
    return {
      status: "collecting",
      ...(data as Omit<InsightsAiAnalysisCollecting, "status">),
    };
  }

  if (hasInsufficientShape(data)) {
    return {
      status: "insufficient",
      ...(data as Omit<InsightsAiAnalysisInsufficient, "status">),
    };
  }

  if (hasReadyShape(data)) {
    const ready = data as Omit<InsightsAiAnalysisReady, "status">;
    return {
      status: "ready",
      ...ready,
      // Tolerate older cached payloads served before behavioural patterns existed.
      patterns: Array.isArray(ready.patterns) ? ready.patterns : [],
    };
  }

  throw new Error("AI analysis response was missing required fields.");
}

// Coerce an unknown patterns array into safe pattern records, dropping any
// malformed entries. Returns [] for maps served before patterns existed.
function normalizeMindMapPatterns(value: unknown): InsightsMindMapPattern[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .filter(
      pattern =>
        typeof pattern.id === "string" && typeof pattern.label === "string"
    )
    .map(pattern => ({
      id: String(pattern.id),
      label: String(pattern.label),
      rationale:
        typeof pattern.rationale === "string" ? pattern.rationale : "",
      evidenceQuote:
        typeof pattern.evidenceQuote === "string" ? pattern.evidenceQuote : "",
      occurrences:
        typeof pattern.occurrences === "number" ? pattern.occurrences : 1,
      confidence:
        typeof pattern.confidence === "number" ? pattern.confidence : 0.5,
    }));
}

const TIER_LABELS: Record<ReflectionRegionTier, string> = {
  low: "Low",
  balanced: "Balanced",
  high: "High",
  very_high: "Very High",
};

const DEFAULT_OVERALL_TIER: OverallReflectionTier = {
  tier: "emerging",
  label: "Emerging Reflector",
  blurb:
    "Your reflections are still taking shape. A few more entries will bring the fuller picture into focus.",
};

function normalizeRegionTier(value: unknown): ReflectionRegionTier {
  return value === "balanced" || value === "high" || value === "very_high"
    ? value
    : "low";
}

// Ensure a region carries a tier band + label even on maps served before tiers
// existed (v4+). Defaults to the neutral "low" band.
function withRegionTierDefaults<T extends { tier?: unknown; tierLabel?: unknown }>(
  region: T
): T & { tier: ReflectionRegionTier; tierLabel: string } {
  const tier = normalizeRegionTier(region.tier);
  return {
    ...region,
    tier,
    tierLabel:
      typeof region.tierLabel === "string" && region.tierLabel.length > 0
        ? region.tierLabel
        : TIER_LABELS[tier],
  };
}

function normalizeOverallTier(value: unknown): OverallReflectionTier {
  if (
    isRecord(value) &&
    typeof value.label === "string" &&
    typeof value.blurb === "string" &&
    (value.tier === "emerging" ||
      value.tier === "balanced" ||
      value.tier === "deeply_reflective" ||
      value.tier === "highly_attuned")
  ) {
    return {
      tier: value.tier,
      label: value.label,
      blurb: value.blurb,
    };
  }

  return DEFAULT_OVERALL_TIER;
}

// Backfill neutral trend, tier, overall-tier, and empty pattern defaults so a
// map served before those fields existed (or a partial response) still renders.
// The backend sends trends on v2+, patterns on v3+, tiers on v4+.
function withReadyDefaults(
  ready: Omit<InsightsMindMapReady, "status">
): Omit<InsightsMindMapReady, "status"> {
  return {
    ...ready,
    patterns: normalizeMindMapPatterns(ready.patterns),
    overallTier: normalizeOverallTier(ready.overallTier),
    regions: ready.regions.map(region =>
      withRegionTierDefaults({
        ...region,
        trend: region.trend ?? "steady",
        trendLabel:
          typeof region.trendLabel === "string" && region.trendLabel.length > 0
            ? region.trendLabel
            : `${region.productLabel} has stayed steady in your recent writing.`,
      })
    ),
  };
}

function normalizeEntryPatterns(value: unknown): MindMapEntryPattern[] {
  return normalizeMindMapPatterns(value).map(pattern => ({
    id: pattern.id,
    label: pattern.label,
    rationale: pattern.rationale,
    evidenceQuote: pattern.evidenceQuote,
    confidence: pattern.confidence,
  }));
}

function normalizeInsightsMindMap(data: unknown): InsightsMindMap {
  if (isRecord(data) && data.status === "ready" && hasMindMapReadyShape(data)) {
    return {
      status: "ready",
      ...withReadyDefaults(data as Omit<InsightsMindMapReady, "status">),
    };
  }

  if (isRecord(data) && data.status === "building" && hasMindMapBuildingShape(data)) {
    return data as InsightsMindMapBuilding;
  }

  if (
    isRecord(data) &&
    data.status === "support_first" &&
    hasMindMapSupportFirstShape(data)
  ) {
    return data as InsightsMindMapSupportFirst;
  }

  if (hasMindMapReadyShape(data)) {
    return {
      status: "ready",
      ...withReadyDefaults(data as Omit<InsightsMindMapReady, "status">),
    };
  }

  if (hasMindMapBuildingShape(data)) {
    return {
      status: "building",
      ...(data as Omit<InsightsMindMapBuilding, "status">),
    };
  }

  if (hasMindMapSupportFirstShape(data)) {
    return {
      status: "support_first",
      ...(data as Omit<InsightsMindMapSupportFirst, "status">),
    };
  }

  throw new Error("Mind Map response was missing required fields.");
}

const getInsightsOverview = async () => {
  const response = await request<InsightsOverview>("/insights/overview", {
    method: "GET",
  });

  return response.data;
};

const getInsightsAiAnalysis = async () => {
  const response = await request<InsightsAiAnalysis>("/insights/ai-analysis", {
    method: "GET",
  });

  return normalizeInsightsAiAnalysis(response.data);
};

const getInsightsMindMap = async (range: InsightsMindMapRange) => {
  const response = await request<InsightsMindMap>(
    `/insights/mind-map?range=${range}`,
    {
      method: "GET",
    }
  );

  return normalizeInsightsMindMap(response.data);
};

function hasEntryMindMapReadyShape(
  value: unknown
): value is Omit<MindMapEntryReady, "status"> {
  return (
    isRecord(value) &&
    typeof value.journalId === "string" &&
    typeof value.strongestRegionId === "string" &&
    Array.isArray(value.regions) &&
    value.regions.every(hasMindMapRegionShape) &&
    isRecord(value.summary) &&
    hasMindMapDisclaimerShape(value.disclaimer)
  );
}

function normalizeMindMapEntry(data: unknown): MindMapEntry {
  if (isRecord(data) && data.status === "support_first") {
    return data as MindMapEntrySupportFirst;
  }

  if (hasEntryMindMapReadyShape(data)) {
    const ready = data as Omit<MindMapEntryReady, "status">;
    return {
      status: "ready",
      ...ready,
      patterns: normalizeEntryPatterns(ready.patterns),
      overallTier: normalizeOverallTier(ready.overallTier),
      regions: ready.regions.map(withRegionTierDefaults),
    };
  }

  throw new Error("Entry Mind Map response was missing required fields.");
}

function normalizeRegionSeries(data: unknown): InsightsRegionSeries {
  if (
    !isRecord(data) ||
    typeof data.regionId !== "string" ||
    !Array.isArray(data.points)
  ) {
    throw new Error("Region series response was missing required fields.");
  }

  const points: InsightsRegionSeriesPoint[] = data.points
    .filter(isRecord)
    .filter(
      point =>
        typeof point.dateKey === "string" && typeof point.value === "number"
    )
    .map(point => ({
      dateKey: String(point.dateKey),
      label:
        typeof point.label === "string" && point.label.length > 0
          ? point.label
          : String(point.dateKey),
      value: Math.min(1, Math.max(0, Number(point.value))),
    }));

  return {
    regionId: data.regionId as BrainReflectionCenterId,
    productLabel:
      typeof data.productLabel === "string" ? data.productLabel : "",
    brainRegionSubtitle:
      typeof data.brainRegionSubtitle === "string"
        ? data.brainRegionSubtitle
        : "",
    range: (data.range === "monthly" || data.range === "all_time"
      ? data.range
      : "latest_week") as InsightsMindMapRange,
    bucket:
      data.bucket === "week" || data.bucket === "month" ? data.bucket : "day",
    startDate: typeof data.startDate === "string" ? data.startDate : null,
    endDate: typeof data.endDate === "string" ? data.endDate : null,
    points,
  };
}

const getInsightsMindMapRegionSeries = async (
  regionId: BrainReflectionCenterId,
  range: InsightsMindMapRange
) => {
  const response = await request<InsightsRegionSeries>(
    `/insights/mind-map/region/${encodeURIComponent(regionId)}/series?range=${range}`,
    {
      method: "GET",
    }
  );

  return normalizeRegionSeries(response.data);
};

const getEntryMindMap = async (journalId: string) => {
  const response = await request<MindMapEntry>(
    `/mind-map/entry/${encodeURIComponent(journalId)}`,
    {
      method: "GET",
    }
  );

  return normalizeMindMapEntry(response.data);
};

export {
  getInsightsOverview,
  getInsightsAiAnalysis,
  getInsightsMindMap,
  getInsightsMindMapRegionSeries,
  getEntryMindMap,
  normalizeInsightsAiAnalysis,
  normalizeInsightsMindMap,
  normalizeMindMapEntry,
  normalizeRegionSeries,
};
export type {
  InsightMood,
  InsightTone,
  InsightsOverview,
  InsightsAiAnalysis,
  InsightsAiAnalysisCollecting,
  InsightsAiAnalysisInsufficient,
  InsightsAiAnalysisReady,
  InsightsMindMap,
  InsightsMindMapBuilding,
  InsightsMindMapDisclaimer,
  InsightsMindMapFocus,
  InsightsMindMapPattern,
  InsightsMindMapPeriod,
  InsightsMindMapRange,
  InsightsMindMapReady,
  InsightsMindMapRegion,
  InsightsMindMapSummary,
  InsightsMindMapSupportFirst,
  InsightsRegionSeries,
  InsightsRegionSeriesPoint,
  MindMapRegionTrend,
  OverallReflectionTier,
  OverallReflectionTierId,
  ReflectionRegionTier,
  MindMapEntry,
  MindMapEntryPattern,
  MindMapEntryReady,
  MindMapEntryRegion,
  MindMapEntrySupportFirst,
};
