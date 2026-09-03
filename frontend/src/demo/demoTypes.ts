import type { JournalEntry } from '../models/journalModels';
import type {
  GuidedReflectionGoDeeperResponse,
  GuidedReflectionGoalSuggestionsResponse,
  GuidedReflectionSessionAnalysisResponse,
  FirstReflectionSummaryResponse,
  GuidedSuggestionAction,
} from '../services/guidedReflectionService';
import type { JadeMessage } from '../services/askJadeService';

export type DemoScenarioStatus = 'draft' | 'captured';
export type DemoMoodScore = 1 | 2 | 3 | 4 | 5;

export type DemoAuthoredEntry = {
  dayOffset: number;
  timeOfDay: string;
  mood: DemoMoodScore;
  answers: [string, string, string];
  tags?: string[];
  detectedTopics?: string[];
  isFavorite?: boolean;
};

export type DemoDateToken = {
  $demoDate: {
    dayOffset: number;
    timeOfDay?: string;
    format: 'dateKey' | 'iso';
  };
};

export type DemoCapturedJadeAnswer = {
  question: string;
  reply: JadeMessage;
};

export type DemoCapturedData = {
  profile: Record<string, unknown>;
  journals: {
    entries: JournalEntry[];
    quickAnalysisByJournalId: Record<string, unknown>;
    sessionAnalysisByJournalId: Record<
      string,
      GuidedReflectionSessionAnalysisResponse
    >;
    entryMindMapByJournalId: Record<string, unknown>;
  };
  moodCheckIns: Record<string, unknown>[];
  insightsOverview: unknown;
  weeklyAnalysis: unknown;
  mindMaps: Record<'latest_week' | 'monthly' | 'all_time', unknown>;
  regionSeries: Record<string, unknown>;
  goals: Record<string, unknown>[];
  goalSuggestionsByJournalId: Record<string, unknown>;
  guidedFlow: {
    firstSummary: FirstReflectionSummaryResponse;
    suggestions: Record<GuidedSuggestionAction, GuidedReflectionGoDeeperResponse>;
    sessionAnalysis: GuidedReflectionSessionAnalysisResponse;
    goalSuggestions: GuidedReflectionGoalSuggestionsResponse;
  };
  askJade: DemoCapturedJadeAnswer[];
  askJadeFallback: DemoCapturedJadeAnswer;
};

export type DemoScenarioFixture = {
  id: string;
  label: string;
  status: DemoScenarioStatus;
  fictional: true;
  generatedAt: string | null;
  sourceModels: Record<string, string[]>;
  captureVersion: number;
  inputHash: string | null;
  outputHash: string | null;
  entries: DemoAuthoredEntry[];
  askJadeQuestions: string[];
  askJadeFallbackQuestion: string;
  filmingEntryDayOffset: number;
  goalSourceDayOffset: number;
  captured: DemoCapturedData | null;
};

export const GUIDED_SUGGESTION_ACTIONS: GuidedSuggestionAction[] = [
  'gentle_prompt',
  'go_deeper',
  'another_perspective',
  'small_next_step',
  'summarize',
];
