import type { JournalEntry } from "./journalModels";

export type RecentJournalEntriesState = {
  recentJournalEntries: JournalEntry[];
  addRecentJournalEntry: (entry: JournalEntry) => void;
  setRecentJournalEntries: (entries: JournalEntry[]) => void;
  mergeRecentJournalEntries: (entries: JournalEntry[]) => void;
};
