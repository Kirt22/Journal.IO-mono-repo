import { request } from "../utils/apiClient";

type InsightMood = "amazing" | "good" | "okay" | "bad" | "terrible";
type InsightTone = "coral" | "blue" | "sage" | "amber" | "slate";

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

type InsightsAiAnalysisPending = {
  status: "pending";
  readiness: {
    joinedAt: string;
    eligibleOn: string;
    daysSinceSignup: number;
    daysUntilReady: number;
    totalEntries: number;
    activeDays: number;
    currentStreak: number;
  };
  summary: {
    headline: string;
    narrative: string;
    highlight: string;
  };
  quickAnalysis: {
    available: boolean;
    title: string;
    description: string;
  };
};

type InsightsAiAnalysisReady = {
  status: "ready";
  window: {
    startDate: string;
    endDate: string;
    label: string;
    entryCount: number;
    activeDays: number;
    totalWords: number;
  };
  freshness: {
    generatedAt: string | null;
    confidence: "low" | "medium" | "high";
    confidenceLabel: string;
    note: string;
  };
  summary: {
    headline: string;
    narrative: string;
    highlight: string;
  };
  patternTags: {
    label: string;
    tone: InsightTone;
  }[];
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

type InsightsAiAnalysis = InsightsAiAnalysisPending | InsightsAiAnalysisReady;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasPendingShape(value: unknown): value is Omit<InsightsAiAnalysisPending, "status"> {
  if (!isRecord(value)) {
    return false;
  }

  return isRecord(value.readiness) && isRecord(value.summary) && isRecord(value.quickAnalysis);
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
    Array.isArray(value.bigFive) &&
    Array.isArray(value.darkTriad) &&
    isRecord(value.actionPlan) &&
    isRecord(value.appSupport)
  );
}

function normalizeInsightsAiAnalysis(data: unknown): InsightsAiAnalysis {
  if (isRecord(data) && data.status === "pending" && hasPendingShape(data)) {
    return data as InsightsAiAnalysisPending;
  }

  if (isRecord(data) && data.status === "ready" && hasReadyShape(data)) {
    return data as InsightsAiAnalysisReady;
  }

  if (hasPendingShape(data)) {
    return {
      status: "pending",
      ...(data as Omit<InsightsAiAnalysisPending, "status">),
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
  InsightsAiAnalysisPending,
  InsightsAiAnalysisReady,
};
