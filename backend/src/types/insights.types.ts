import type { MoodValue } from "./mood.types";
import type {
  OverallReflectionTier,
  ReflectionRegionId,
  ReflectionRegionIntensity,
  ReflectionRegionTier,
  ReflectionRegionTrend,
} from "../helpers/reflectionMap.helpers";

export type InsightTone =
  | "coral"
  | "blue"
  | "sage"
  | "amber"
  | "slate";

export type InsightsAiAnalysisWindow = {
  startDate: string;
  endDate: string;
  label: string;
  entryCount: number;
  activeDays: number;
  totalWords: number;
  minimumActiveDays: number;
};

export type InsightsAiAnalysisProgress = {
  currentDayOfWindow: number;
  daysRemaining: number;
  minimumActiveDays: number;
  activeDays: number;
  entriesNeeded: number;
  completionPercentage: number;
  promptState: "zero_entries" | "building" | "almost_ready" | "missed";
};

export type InsightsAiAnalysisSummary = {
  headline: string;
  narrative: string;
  highlight: string;
};

export type InsightsAiAnalysisQuickAnalysis = {
  available: boolean;
  title: string;
  description: string;
};

export type InsightsAiAnalysisCollectingResponse = {
  status: "collecting";
  window: InsightsAiAnalysisWindow;
  progress: InsightsAiAnalysisProgress;
  summary: InsightsAiAnalysisSummary;
  quickAnalysis: InsightsAiAnalysisQuickAnalysis;
};

export type InsightsAiAnalysisInsufficientResponse = {
  status: "insufficient";
  window: InsightsAiAnalysisWindow;
  progress: InsightsAiAnalysisProgress & {
    nextWindowStartDate: string;
    nextWindowEndDate: string;
    nextWindowLabel: string;
  };
  summary: {
    headline: string;
    narrative: string;
    highlight: string;
  };
  quickAnalysis: InsightsAiAnalysisQuickAnalysis;
};

export type InsightsAiAnalysisReadyResponse = {
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
  // Behavioural patterns the week kept surfacing — the recurring behaviour and
  // the trigger/feeling it connects to, plus one gentle, non-judgmental nudge.
  // Replaces the earlier Big Five / dark-triad personality-trait framing.
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

export type InsightsAiAnalysisResponse =
  | InsightsAiAnalysisCollectingResponse
  | InsightsAiAnalysisInsufficientResponse
  | InsightsAiAnalysisReadyResponse;

export type InsightsMindMapRange = "latest_week" | "monthly" | "all_time";

// A recurring behavioural/emotional theme aggregated from persisted per-entry
// insights, with the reason it was concluded and the user's own supporting
// sentence. Ordered by how often it recurs across the window.
export type InsightsMindMapPattern = {
  id: string;
  label: string;
  rationale: string;
  evidenceQuote: string;
  occurrences: number;
  confidence: number;
};

export type InsightsMindMapPeriod = {
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

export type InsightsMindMapDisclaimer = {
  title: string;
  body: string;
};

export type InsightsMindMapSummary = {
  headline: string;
  narrative: string;
  note: string;
};

export type InsightsMindMapRegion = {
  id: ReflectionRegionId;
  productLabel: string;
  brainRegionSubtitle: string;
  signalScore: number;
  confidence: number;
  rank: number;
  intensity: ReflectionRegionIntensity;
  shortInsight: string;
  // A single practical, non-clinical next step to try for this region.
  actionStep: string;
  evidenceSnippets: string[];
  trend: ReflectionRegionTrend;
  trendLabel: string;
  // How strongly this region shows up versus a typical reflector (band only).
  tier: ReflectionRegionTier;
  tierLabel: string;
};

export type InsightsMindMapFocus = {
  headline: string;
  body: string;
  regionId: ReflectionRegionId;
};

export type InsightsMindMapReadyResponse = {
  status: "ready";
  period: InsightsMindMapPeriod;
  summary: InsightsMindMapSummary;
  strongestRegionId: ReflectionRegionId;
  // Most recurring patterns across the window, ordered most-recurring first.
  // Shown after the strongest region and before the remaining region scores.
  patterns: InsightsMindMapPattern[];
  regions: InsightsMindMapRegion[];
  focus: InsightsMindMapFocus;
  // Overall reflective style across the window (named band, no numbers).
  overallTier: OverallReflectionTier;
  disclaimer: InsightsMindMapDisclaimer;
};

export type InsightsMindMapBuildingResponse = {
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

export type InsightsMindMapSupportFirstResponse = {
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

export type InsightsMindMapResponse =
  | InsightsMindMapReadyResponse
  | InsightsMindMapBuildingResponse
  | InsightsMindMapSupportFirstResponse;

// A single point on a region's development graph: an averaged signal for one
// day/week bucket, keyed by the bucket's start date (YYYY-MM-DD).
export type InsightsRegionSeriesPoint = {
  dateKey: string;
  label: string;
  value: number;
};

export type InsightsRegionSeriesResponse = {
  regionId: ReflectionRegionId;
  productLabel: string;
  brainRegionSubtitle: string;
  range: InsightsMindMapRange;
  bucket: "day" | "week" | "month";
  startDate: string | null;
  endDate: string | null;
  points: InsightsRegionSeriesPoint[];
};

export type InsightsOverviewResponse = {
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
    mood: MoodValue;
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
