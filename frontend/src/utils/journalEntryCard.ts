import type { JournalEntry } from "../models/journalModels";

export type JournalEntryCardTone = "warm" | "challenge" | "reflective" | "supportive";

export type JournalEntryCardSource = Pick<
  JournalEntry,
  "title" | "content" | "type" | "tags" | "createdAt" | "isFavorite"
>;

const QUICK_THOUGHT_EMOJI = "💬";
const JOURNAL_PLACEHOLDER_EMOJI = "📄";
const MOOD_EMOJIS: Record<string, string> = {
  amazing: "🤩",
  good: "😊",
  okay: "😌",
  bad: "😔",
  terrible: "😢",
};

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

  return mood in MOOD_EMOJIS ? mood : null;
}

function getFilteredTags(tags: string[]) {
  return tags.filter(tag => !tag.toLowerCase().startsWith("mood:"));
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

function getEntryEmoji(entry: Pick<JournalEntryCardSource, "tags" | "type">) {
  if (entry.type === "quick-thought") {
    return QUICK_THOUGHT_EMOJI;
  }

  if (entry.type === "mood-checkin") {
    return "🫶";
  }

  const moodValue = getMoodValue(entry.tags);

  if (moodValue) {
    return MOOD_EMOJIS[moodValue];
  }

  return JOURNAL_PLACEHOLDER_EMOJI;
}

function getEntryTitle(entry: Pick<JournalEntryCardSource, "title" | "type" | "createdAt">) {
  if (entry.type === "quick-thought") {
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
  getEntryEmoji,
  getEntryTitle,
  getEntryTone,
  getFilteredTags,
};
