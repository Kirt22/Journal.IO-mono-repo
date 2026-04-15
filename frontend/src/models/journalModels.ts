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
  summary: {
    headline: string;
    narrative: string;
    highlight: string;
  };
  scorecard: {
    vibeLabel: string;
    vibeTone: "coral" | "blue" | "sage" | "amber" | "slate";
    cards: {
      key: "words" | "mood" | "focus" | "depth";
      label: string;
      value: string;
      tone: "coral" | "blue" | "sage" | "amber" | "slate";
    }[];
  };
  patternTags: {
    label: string;
    tone: "coral" | "blue" | "sage" | "amber" | "slate";
  }[];
  signals: {
    whatStoodOut: {
      title: string;
      description: string;
      evidence: string[];
      tone: "coral" | "blue" | "sage" | "amber" | "slate";
    };
    whatNeedsCare: {
      title: string;
      description: string;
      evidence: string[];
      tone: "coral" | "blue" | "sage" | "amber" | "slate";
    };
    whatToCarryForward: {
      title: string;
      description: string;
      evidence: string[];
      tone: "coral" | "blue" | "sage" | "amber" | "slate";
    };
  };
  nextStep: {
    title: string;
    description: string;
    focus: string;
  };
  generatedAt: string | null;
};
