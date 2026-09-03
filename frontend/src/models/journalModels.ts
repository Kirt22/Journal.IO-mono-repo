export type JournalEntryMode = 'open_ended' | 'guided';
export type JournalEntryKind = 'journal' | 'quick_thought';
export type DetectedMood = 'amazing' | 'good' | 'okay' | 'bad' | 'terrible';
// Read compatibility keeps historic entries renderable while writes use JournalEntryMode.
export type JournalEntryType = JournalEntryMode | (string & {});

export type CreateJournalPayload = {
  title: string;
  content: string;
  type?: JournalEntryMode;
  entryKind?: JournalEntryKind;
  aiPrompt?: string;
  /**
   * The exact strings the app itself put into `content` — guided section
   * labels, Journal.IO's own reflection and questions, or any writing prompt
   * the user tapped to insert. The backend removes these before treating the
   * entry as the person's own words, so app text is never quoted back at them
   * as evidence or mined into their pattern graph.
   */
  appAuthoredSegments?: string[];
  images?: string[];
  tags?: string[];
  isFavorite?: boolean;
};

export type UpdateJournalPayload = {
  journalId: string;
  title: string;
  content: string;
  type?: JournalEntryMode;
  aiPrompt?: string;
  images?: string[];
  tags?: string[];
  isFavorite?: boolean;
};

export type JournalEntry = {
  _id: string;
  title: string;
  content: string;
  type: JournalEntryType;
  entryKind?: JournalEntryKind;
  aiPrompt: string | null;
  images: string[] | null;
  tags: string[];
  detectedTopics?: string[];
  detectedMood?: DetectedMood | null;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type JournalEntryApiRecord = Omit<
  JournalEntry,
  'tags' | 'detectedTopics' | 'detectedMood'
> & {
  tags?: string[];
  detectedTopics?: string[];
  detectedMood?: DetectedMood | null;
  isFavorite?: boolean;
};

export type JournalEntryPage = {
  entries: JournalEntry[];
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

export type JournalEntryPageApiRecord = Omit<JournalEntryPage, 'entries'> & {
  entries: JournalEntryApiRecord[];
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
    vibeTone: 'coral' | 'blue' | 'sage' | 'amber' | 'slate';
    cards: {
      key: 'words' | 'mood' | 'focus' | 'depth';
      label: string;
      value: string;
      tone: 'coral' | 'blue' | 'sage' | 'amber' | 'slate';
    }[];
  };
  patternTags: {
    label: string;
    tone: 'coral' | 'blue' | 'sage' | 'amber' | 'slate';
  }[];
  signals: {
    whatStoodOut: {
      title: string;
      description: string;
      evidence: string[];
      tone: 'coral' | 'blue' | 'sage' | 'amber' | 'slate';
    };
    whatNeedsCare: {
      title: string;
      description: string;
      evidence: string[];
      tone: 'coral' | 'blue' | 'sage' | 'amber' | 'slate';
    };
    whatToCarryForward: {
      title: string;
      description: string;
      evidence: string[];
      tone: 'coral' | 'blue' | 'sage' | 'amber' | 'slate';
    };
  };
  nextStep: {
    title: string;
    description: string;
    focus: string;
  };
  // Optional "this echoes something from before" line drawn from long-term
  // memory. Null when there is no genuine connection.
  connection: string | null;
  generatedAt: string | null;
};
