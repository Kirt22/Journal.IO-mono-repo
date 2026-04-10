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
  headline: string;
  summary: string;
  patternTags: {
    label: string;
    tone: InsightTone;
  }[];
  nextStep: string;
  generatedAt: string | null;
};
