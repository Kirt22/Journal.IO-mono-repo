export type CreateJournalPayload = {
  title: string;
  content: string;
  type?: string;
  aiPrompt?: string;
  images?: string[];
  tags?: string[];
  isFavorite?: boolean;
};

export type UpdateJournalPayload = {
  journalId: string;
  title: string;
  content: string;
  type?: string;
  aiPrompt?: string;
  images?: string[];
  tags?: string[];
  isFavorite?: boolean;
};

export type JournalEntry = {
  _id: string;
  title: string;
  content: string;
  type: string;
  aiPrompt: string | null;
  images: string[] | null;
  tags: string[];
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type JournalEntryApiRecord = Omit<JournalEntry, "tags"> & {
  tags?: string[];
  isFavorite?: boolean;
};

export type JournalTagSuggestions = {
  tags: string[];
};

export type JournalQuickAnalysis = {
  journalId: string;
  headline: string;
  summary: string;
  patternTags: {
    label: string;
    tone: "coral" | "blue" | "sage" | "amber" | "slate";
  }[];
  nextStep: string;
  generatedAt: string | null;
};
