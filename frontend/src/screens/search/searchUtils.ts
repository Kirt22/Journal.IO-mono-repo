import type { JournalEntry } from "../../models/journalModels";

const PRELOADED_SEARCH_TAGS = [
  "anxiety",
  "challenges",
  "connection",
  "creativity",
  "dreams",
  "evening",
  "family",
  "fitness",
  "goals",
  "gratitude",
  "growth",
  "happiness",
  "health",
  "meditation",
  "mindfulness",
  "mood-checkin",
  "morning",
  "motivation",
  "nature",
  "overwhelm",
  "reflection",
  "relationships",
  "self-care",
  "stress",
  "therapy",
  "travel",
  "work",
];

type SearchFilters = {
  query: string;
  selectedTags: string[];
  favoritesOnly: boolean;
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const normalizeTag = (value: string) => value.trim().toLowerCase();

const matchesQuery = (entry: JournalEntry, query: string) => {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return true;
  }

  const searchableText = [
    entry.title,
    entry.content,
    entry.type,
    ...entry.tags,
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedQuery);
};

const matchesSelectedTags = (entry: JournalEntry, selectedTags: string[]) => {
  if (!selectedTags.length) {
    return true;
  }

  const entryTags = new Set(entry.tags.map(normalizeTag));

  return selectedTags.some(tag => entryTags.has(normalizeTag(tag)));
};

const matchesFavorites = (entry: JournalEntry, favoritesOnly: boolean) =>
  !favoritesOnly || Boolean(entry.isFavorite);

const filterSearchEntries = (
  entries: JournalEntry[],
  filters: SearchFilters
) => {
  return entries.filter(entry => {
    return (
      matchesQuery(entry, filters.query) &&
      matchesSelectedTags(entry, filters.selectedTags) &&
      matchesFavorites(entry, filters.favoritesOnly)
    );
  });
};

const buildSearchTags = (entries: JournalEntry[]) => {
  const entryTags = Array.from(
    new Set(entries.flatMap(entry => entry.tags.map(normalizeTag)))
  ).sort();

  const combined = [...PRELOADED_SEARCH_TAGS];

  entryTags.forEach(tag => {
    if (!combined.includes(tag)) {
      combined.push(tag);
    }
  });

  return combined;
};

export {
  PRELOADED_SEARCH_TAGS,
  buildSearchTags,
  filterSearchEntries,
  matchesFavorites,
  matchesQuery,
  matchesSelectedTags,
};
export type { SearchFilters };
