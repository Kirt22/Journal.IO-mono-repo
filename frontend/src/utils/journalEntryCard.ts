import type { JournalEntry } from "../models/journalModels";
import { normalizeJournalEntryKind } from "./journalEntryKind";

export type JournalEntryCardTone = "warm" | "challenge" | "reflective" | "supportive";
export type JournalEntryVisualKey =
  | "guided"
  | "open-ended"
  | "quick-thought";

export type JournalEntryCardSource = Pick<
  JournalEntry,
  | "title"
  | "content"
  | "type"
  | "entryKind"
  | "tags"
  | "detectedTopics"
  | "createdAt"
  | "isFavorite"
>;

const MOOD_TONES: Record<string, JournalEntryCardTone> = {
  amazing: "warm",
  good: "supportive",
  okay: "reflective",
  bad: "challenge",
  terrible: "challenge",
};

function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const month = new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(date);
  const day = date.getDate();
  const year = date.getFullYear();

  return `${month} ${day} ${year}`;
}

function getMoodTag(tags: string[]) {
  return tags.find(tag => tag.toLowerCase().startsWith("mood:")) || null;
}

function getMoodValue(tags: string[]) {
  const moodTag = getMoodTag(tags);

  if (!moodTag) {
    return null;
  }

  const mood = moodTag.split(":")[1]?.trim().toLowerCase() || "";

  return mood in MOOD_TONES ? mood : null;
}

function isInternalJournalTag(tag: string) {
  return tag.trim().toLowerCase().startsWith("onboarding:");
}

function getFilteredTags(tags: string[]) {
  return tags.filter(tag => {
    const normalizedTag = tag.trim().toLowerCase();

    return (
      Boolean(normalizedTag) &&
      !normalizedTag.startsWith("mood:") &&
      !isInternalJournalTag(normalizedTag)
    );
  });
}

function getEntryDisplayTags(entry: JournalEntryCardSource) {
  const sourceTags =
    getEntryVisualKey(entry) === "quick-thought"
      ? entry.tags
      : entry.detectedTopics || [];
  const seenTags = new Set<string>();

  return getFilteredTags(sourceTags).filter(tag => {
    const normalizedTag = tag.trim().toLowerCase();

    if (seenTags.has(normalizedTag)) {
      return false;
    }

    seenTags.add(normalizedTag);
    return true;
  });
}

function formatEntryTagLabel(tag: string) {
  return tag
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getEntryTone(entry: Pick<JournalEntryCardSource, "tags" | "type" | "isFavorite">): JournalEntryCardTone {
  if (entry.isFavorite) {
    return "warm";
  }

  const moodValue = getMoodValue(entry.tags);

  if (moodValue) {
    return MOOD_TONES[moodValue];
  }

  if (entry.type === "mood-checkin") {
    return "supportive";
  }

  if (entry.type === "quick-thought") {
    return "reflective";
  }

  const tags = new Set(entry.tags.map(tag => tag.toLowerCase()));

  if (tags.has("work") || tags.has("challenge") || tags.has("challenges")) {
    return "challenge";
  }

  if (tags.has("meditation") || tags.has("mindfulness") || tags.has("reflection")) {
    return "reflective";
  }

  if (tags.has("gratitude") || tags.has("family") || tags.has("morning") || tags.has("nature")) {
    return "warm";
  }

  return "reflective";
}

function getEntryVisualKey(
  entry: Pick<JournalEntryCardSource, "entryKind" | "title" | "type">
): JournalEntryVisualKey {
  if (entry.type === "guided") {
    return "guided";
  }

  if (
    entry.type === "quick-thought" ||
    normalizeJournalEntryKind(entry.entryKind, entry.title) === "quick_thought"
  ) {
    return "quick-thought";
  }

  return "open-ended";
}

function getEntryTitle(
  entry: Pick<
    JournalEntryCardSource,
    "createdAt" | "entryKind" | "title" | "type"
  >
) {
  if (
    entry.type === "quick-thought" ||
    normalizeJournalEntryKind(entry.entryKind, entry.title) === "quick_thought"
  ) {
    return "Quick Thought";
  }

  const trimmedTitle = entry.title.trim();

  if (trimmedTitle && trimmedTitle.toLowerCase() !== "untitled") {
    return trimmedTitle;
  }

  return `Entry for ${formatDate(entry.createdAt)}`;
}

export {
  formatDate,
  formatEntryTagLabel,
  getEntryDisplayTags,
  getEntryVisualKey,
  getEntryTitle,
  getEntryTone,
  getFilteredTags,
  isInternalJournalTag,
};
