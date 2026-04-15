import { request } from "../utils/apiClient";

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

export { getInsightsOverview, getInsightsAiAnalysis, normalizeInsightsAiAnalysis };
export type {
  InsightMood,
  InsightTone,
  InsightsOverview,
  InsightsAiAnalysis,
  InsightsAiAnalysisCollecting,
  InsightsAiAnalysisInsufficient,
  InsightsAiAnalysisReady,
};
