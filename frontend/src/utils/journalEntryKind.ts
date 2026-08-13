import type { JournalEntryKind } from "../models/journalModels";

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

  return title?.trim().toLowerCase() === "quick thought"
    ? "quick_thought"
    : "journal";
};

export { normalizeJournalEntryKind };
