const RESERVED_JOURNAL_TAG_PREFIXES = ["onboarding:"] as const;

const isReservedJournalTag = (tag: string) => {
  const normalizedTag = tag.trim().toLowerCase();

  return RESERVED_JOURNAL_TAG_PREFIXES.some(prefix =>
    normalizedTag.startsWith(prefix)
  );
};

const filterReservedJournalTags = (tags: readonly string[]) =>
  tags.filter(tag => !isReservedJournalTag(tag));

export { filterReservedJournalTags, isReservedJournalTag };
