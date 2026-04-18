import type { MoodValue } from "./mood.types";

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
    highlight: string;
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
  | InsightsAiAnalysisCollectingResponse
  | InsightsAiAnalysisInsufficientResponse
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
