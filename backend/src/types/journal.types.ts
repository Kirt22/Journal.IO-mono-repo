import type { InsightTone } from "./insights.types";
import type {
  DetectedMood,
  EntryTopic,
} from "../helpers/entryMetadata.helpers";

export type JournalEntryMode = "open_ended" | "guided";
export type JournalEntryKind = "journal" | "quick_thought";

export type JournalEntryResponse = {
  _id: string;
  title: string;
  content: string;
  type: JournalEntryMode;
  entryKind: JournalEntryKind;
  aiPrompt: string | null;
  tags: string[];
  detectedTopics: EntryTopic[];
  detectedMood: DetectedMood | null;
  images: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type JournalListInput = {
  userId: string;
  limit: number;
  cursor?: string;
  from?: string;
  to?: string;
};

export type JournalListResponse = {
  entries: JournalEntryResponse[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    matchingCount: number;
  };
  summary: {
    totalEntries: number;
    favoriteEntries: number;
  };
};

export type CreateJournalInput = {
  userId: string;
  title: string;
  content: string;
  type?: JournalEntryMode;
  entryKind?: JournalEntryKind;
  aiPrompt?: string;
  tags?: string[];
  images?: string[];
};

export type UpdateJournalInput = {
  userId: string;
  journalId: string;
  title: string;
  content: string;
  type?: JournalEntryMode;
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

export type JournalSessionAnalysisInput = {
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
  // Optional "this echoes something from before" line drawn from the user's
  // long-term reflection memory. Null when there is no genuine connection or
  // memory is unavailable.
  connection: string | null;
  generatedAt: string | null;
};
