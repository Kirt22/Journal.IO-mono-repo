import type { JournalEntryKind } from "../types/journal.types";

const LEGACY_QUICK_THOUGHT_TITLE = "quick thought";

const normalizeJournalEntryKind = (
  value?: string | null,
  title?: string | null
): JournalEntryKind => {
  if (value === "quick_thought") {
    return "quick_thought";
  }

  if (value === "journal") {
    return "journal";
  }

  return title?.trim().toLowerCase() === LEGACY_QUICK_THOUGHT_TITLE
    ? "quick_thought"
    : "journal";
};

export { normalizeJournalEntryKind };
