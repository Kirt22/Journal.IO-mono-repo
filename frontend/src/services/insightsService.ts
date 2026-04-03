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

type InsightsAiAnalysis = {
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

  return response.data;
};

export { getInsightsOverview, getInsightsAiAnalysis };
export type { InsightMood, InsightTone, InsightsOverview, InsightsAiAnalysis };
