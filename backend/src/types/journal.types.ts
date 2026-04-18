import type { InsightTone } from "./insights.types";

export type JournalEntryResponse = {
  _id: string;
  title: string;
  content: string;
  type: string;
  aiPrompt: string | null;
  tags: string[];
  images: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateJournalInput = {
  userId: string;
  title: string;
  content: string;
  type?: string;
  aiPrompt?: string;
  tags?: string[];
  images?: string[];
};

export type UpdateJournalInput = {
  userId: string;
  journalId: string;
  title: string;
  content: string;
  type?: string;
  aiPrompt?: string;
  tags?: string[];
  images?: string[];
  isFavorite?: boolean;
};

export type ToggleJournalFavoriteInput = {
  userId: string;
  journalId: string;
  isFavorite: boolean;
};

export type JournalLookupInput = {
  userId: string;
  journalId: string;
};

export type SuggestJournalTagsInput = {
  userId: string;
  content: string;
  selectedTags?: string[];
  mood?: "amazing" | "good" | "okay" | "bad" | "terrible";
};

export type JournalTagSuggestionsResponse = {
  tags: string[];
};

export type JournalQuickAnalysisInput = {
  userId: string;
  journalId: string;
};

export type JournalQuickAnalysisResponse = {
  journalId: string;
  summary: {
    headline: string;
    narrative: string;
    highlight: string;
  };
  scorecard: {
    vibeLabel: string;
    vibeTone: InsightTone;
    cards: {
      key: "words" | "mood" | "focus" | "depth";
      label: string;
      value: string;
      tone: InsightTone;
    }[];
  };
  patternTags: {
    label: string;
    tone: InsightTone;
  }[];
  signals: {
    whatStoodOut: {
      title: string;
      description: string;
      evidence: string[];
      tone: InsightTone;
    };
    whatNeedsCare: {
      title: string;
      description: string;
      evidence: string[];
      tone: InsightTone;
    };
    whatToCarryForward: {
      title: string;
      description: string;
      evidence: string[];
      tone: InsightTone;
    };
  };
  nextStep: {
    title: string;
    description: string;
    focus: string;
  };
  generatedAt: string | null;
};
