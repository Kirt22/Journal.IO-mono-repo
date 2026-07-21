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
  summary: InsightsAiAnalysisSummary;
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
  bigFive: {
    trait:
      | "openness"
      | "conscientiousness"
      | "extraversion"
      | "agreeableness"
      | "neuroticism";
    label: string;
    score: number;
    band: "emerging" | "steady" | "pronounced";
    description: string;
    evidenceTags: string[];
  }[];
  darkTriad: {
    trait: "narcissism" | "machiavellianism" | "psychopathy";
    label: string;
    supportiveLabel: string;
    score: number;
    band: "low" | "watch" | "elevated";
    description: string;
    supportTip: string;
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

type InsightsMindMapRange = "latest_week" | "all_time";

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

type InsightsMindMapRegion = {
  id: BrainReflectionCenterId;
  productLabel: string;
  brainRegionSubtitle: string;
  signalScore: number;
  confidence: number;
  rank: number;
  intensity: "low" | "moderate" | "high";
  shortInsight: string;
  evidenceSnippets: string[];
};

type InsightsMindMapReady = {
  status: "ready";
  period: InsightsMindMapPeriod;
  summary: InsightsMindMapSummary;
  strongestRegionId: BrainReflectionCenterId;
  regions: InsightsMindMapRegion[];
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
    Array.isArray(value.bigFive) &&
    Array.isArray(value.darkTriad) &&
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
    return {
      status: "ready",
      ...(data as Omit<InsightsAiAnalysisReady, "status">),
    };
  }

  throw new Error("AI analysis response was missing required fields.");
}

function normalizeInsightsMindMap(data: unknown): InsightsMindMap {
  if (isRecord(data) && data.status === "ready" && hasMindMapReadyShape(data)) {
    return data as InsightsMindMapReady;
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
      ...(data as Omit<InsightsMindMapReady, "status">),
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

export {
  getInsightsOverview,
  getInsightsAiAnalysis,
  getInsightsMindMap,
  normalizeInsightsAiAnalysis,
  normalizeInsightsMindMap,
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
  InsightsMindMapPeriod,
  InsightsMindMapRange,
  InsightsMindMapReady,
  InsightsMindMapRegion,
  InsightsMindMapSummary,
  InsightsMindMapSupportFirst,
};
