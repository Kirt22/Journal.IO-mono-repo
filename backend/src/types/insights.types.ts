import type { MoodValue } from "./mood.types";

export type InsightTone =
  | "coral"
  | "blue"
  | "sage"
  | "amber"
  | "slate";

export type InsightsAiAnalysisPendingResponse = {
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

export type InsightsAiAnalysisReadyResponse = {
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

export type InsightsAiAnalysisResponse =
  | InsightsAiAnalysisPendingResponse
  | InsightsAiAnalysisReadyResponse;
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
