import type { JournalEntry } from "../../models/journalModels";

const MAX_RECENT_JOURNAL_ENTRIES = 10;

export type JournalSliceState = {
  recentJournalEntries: JournalEntry[];
  addRecentJournalEntry: (entry: JournalEntry) => void;
  updateRecentJournalEntry: (entry: JournalEntry) => void;
  removeRecentJournalEntry: (entryId: string) => void;
  setRecentJournalEntries: (entries: JournalEntry[]) => void;
  mergeRecentJournalEntries: (entries: JournalEntry[]) => void;
};

type RecentJournalEntriesState = Pick<
  JournalSliceState,
  "recentJournalEntries"
>;
 
type JournalSliceSetState = (
  updater:
    | Partial<RecentJournalEntriesState>
    | ((
        state: RecentJournalEntriesState
      ) => Partial<RecentJournalEntriesState>)
) => void;

const dedupeRecentJournalEntries = (entries: JournalEntry[]) => {
  const seen = new Set<string>();

  return entries.filter(entry => {
    if (seen.has(entry._id)) {
      return false;
    }

    seen.add(entry._id);
    return true;
  });
};

const trimRecentJournalEntries = (entries: JournalEntry[]) =>
  dedupeRecentJournalEntries(entries).slice(0, MAX_RECENT_JOURNAL_ENTRIES);

const createInitialJournalSliceState = (
  initialEntries: JournalEntry[] = []
): Pick<JournalSliceState, "recentJournalEntries"> => ({
  recentJournalEntries: trimRecentJournalEntries(initialEntries),
});

const createJournalSlice = (
  set: JournalSliceSetState,
  initialEntries: JournalEntry[] = []
): JournalSliceState => ({
  ...createInitialJournalSliceState(initialEntries),
  addRecentJournalEntry: entry => {
    set(state => ({
      recentJournalEntries: trimRecentJournalEntries([
        entry,
        ...state.recentJournalEntries,
      ]),
    }));
  },
  updateRecentJournalEntry: entry => {
    set(state => {
      const nextEntries = state.recentJournalEntries.some(
        current => current._id === entry._id
      )
        ? state.recentJournalEntries.map(current =>
            current._id === entry._id ? entry : current
          )
        : [entry, ...state.recentJournalEntries];

      return {
        recentJournalEntries: trimRecentJournalEntries(nextEntries),
      };
    });
  },
  removeRecentJournalEntry: entryId => {
    set(state => ({
      recentJournalEntries: state.recentJournalEntries.filter(
        entry => entry._id !== entryId
      ),
    }));
  },
  setRecentJournalEntries: entries => {
    set({
      recentJournalEntries: trimRecentJournalEntries(entries),
    });
  },
  mergeRecentJournalEntries: entries => {
    set(state => ({
      recentJournalEntries: trimRecentJournalEntries([
        ...entries,
        ...state.recentJournalEntries,
      ]),
    }));
  },
});

export { createInitialJournalSliceState, createJournalSlice };
