import { BookOpen, Heart, Smile, Sparkles, Star } from "lucide-react-native";
import type { JournalEntry } from "./journalModels";

export type CalendarEntryTone = "warm" | "challenge" | "reflective" | "supportive";

export type CalendarEntry = {
  id: string;
  date: Date;
  createdAt: string;
  title: string;
  content: string;
  tags: string[];
  type: string;
  isFavorite: boolean;
  tone: CalendarEntryTone;
  icon: typeof Heart;
};

type CalendarDecoration = {
  isFavorite: boolean;
  tone: CalendarEntryTone;
  icon: typeof Heart;
};

const seededCalendarDecorations: Record<string, CalendarDecoration> = {
  "mar-15": {
    isFavorite: true,
    tone: "supportive",
    icon: Heart,
  },
  "mar-14": {
    isFavorite: false,
    tone: "challenge",
    icon: Smile,
  },
  "mar-13": {
    isFavorite: true,
    tone: "reflective",
    icon: Sparkles,
  },
  "mar-12": {
    isFavorite: false,
    tone: "warm",
    icon: Heart,
  },
  "mar-11": {
    isFavorite: false,
    tone: "reflective",
    icon: Star,
  },
};

function inferCalendarDecoration(entry: JournalEntry): CalendarDecoration {
  if (entry.isFavorite) {
    return {
      isFavorite: true,
      tone: "warm",
      icon: Star,
    };
  }

  const tags = new Set(entry.tags.map(tag => tag.toLowerCase()));

  if (entry.type === "mood-checkin") {
    return {
      isFavorite: false,
      tone: "supportive",
      icon: Heart,
    };
  }

  if (tags.has("work") || tags.has("challenge") || tags.has("challenges")) {
    return {
      isFavorite: false,
      tone: "challenge",
      icon: Smile,
    };
  }

  if (tags.has("meditation") || tags.has("mindfulness") || tags.has("reflection")) {
    return {
      isFavorite: false,
      tone: "reflective",
      icon: Sparkles,
    };
  }

  if (tags.has("gratitude") || tags.has("family") || tags.has("morning") || tags.has("nature")) {
    return {
      isFavorite: true,
      tone: "warm",
      icon: Heart,
    };
  }

  return {
    isFavorite: false,
    tone: "reflective",
    icon: BookOpen,
  };
}

export const calendarSampleEntries: CalendarEntry[] = [
  {
    id: "mar-15",
    date: new Date(2026, 2, 15),
    title: "Morning Reflections",
    content:
      "Started the day with a beautiful sunrise walk. Feeling grateful for the small moments of peace. The crisp air helped reset my mind for the week ahead.",
    tags: ["gratitude", "morning", "nature"],
    isFavorite: true,
    tone: "supportive",
    icon: Heart,
  },
  {
    id: "mar-14",
    date: new Date(2026, 2, 14),
    title: "Challenging Day at Work",
    content:
      "Today was tough. Had a difficult meeting that didn't go as planned. But I learned something important about speaking up earlier.",
    tags: ["work", "growth", "challenges"],
    isFavorite: false,
    tone: "challenge",
    icon: Smile,
  },
  {
    id: "mar-13",
    date: new Date(2026, 2, 13),
    title: "Evening Meditation",
    content:
      "Spent 20 minutes in meditation tonight. My mind was racing at first, but eventually found stillness. These pauses seem to help more than I expect.",
    tags: ["meditation", "mindfulness", "evening"],
    isFavorite: true,
    tone: "reflective",
    icon: Sparkles,
  },
  {
    id: "mar-12",
    date: new Date(2026, 2, 12),
    title: "Family Time",
    content:
      "Had dinner with family and felt recharged afterward. The evening was simple, calm, and exactly what I needed.",
    tags: ["family", "connection", "rest"],
    isFavorite: false,
    tone: "warm",
    icon: Heart,
  },
  {
    id: "mar-11",
    date: new Date(2026, 2, 11),
    title: "Planning Ahead",
    content:
      "Spent time organizing tomorrow's tasks. Writing them down reduced a lot of noise in my head and made the evening feel lighter.",
    tags: ["planning", "routine", "focus"],
    isFavorite: false,
    tone: "reflective",
    icon: Star,
  },
  {
    id: "mar-10",
    date: new Date(2026, 2, 10),
    title: "Quiet Reset",
    content:
      "Took a slower pace today and noticed how much it helped my focus. Small pauses made the evening feel more grounded.",
    tags: ["rest", "focus", "routine"],
    isFavorite: false,
    tone: "reflective",
    icon: BookOpen,
  },
  {
    id: "mar-9",
    date: new Date(2026, 2, 9),
    title: "Deep Work Session",
    content:
      "Had a productive block of time where distractions stayed low. It felt good to make steady progress on one important task.",
    tags: ["work", "focus", "productivity"],
    isFavorite: false,
    tone: "challenge",
    icon: Star,
  },
  {
    id: "mar-8",
    date: new Date(2026, 2, 8),
    title: "Checking In With Family",
    content:
      "Called family in the evening and felt lighter afterward. The conversation was simple but meaningful.",
    tags: ["family", "connection", "evening"],
    isFavorite: true,
    tone: "warm",
    icon: Heart,
  },
  {
    id: "mar-7",
    date: new Date(2026, 2, 7),
    title: "Notebook Thoughts",
    content:
      "Wrote down a few loose thoughts before bed. Getting them out of my head made the night feel calmer.",
    tags: ["reflection", "night", "notes"],
    isFavorite: false,
    tone: "reflective",
    icon: Sparkles,
  },
  {
    id: "mar-6",
    date: new Date(2026, 2, 6),
    title: "Morning Walk",
    content:
      "Started the day with a short walk and some fresh air. It helped me settle into the day more easily.",
    tags: ["morning", "nature", "energy"],
    isFavorite: false,
    tone: "supportive",
    icon: Heart,
  },
];

export const calendarSampleJournalEntries: JournalEntry[] = calendarSampleEntries.map(
  entry => ({
    _id: entry.id,
    title: entry.title,
    content: entry.content,
    type: "journal",
    images: [],
    tags: entry.tags,
    createdAt: entry.date.toISOString(),
    updatedAt: entry.date.toISOString(),
  })
);

export function toCalendarEntry(entry: JournalEntry): CalendarEntry {
  const decoration = seededCalendarDecorations[entry._id] || inferCalendarDecoration(entry);

  return {
    id: entry._id,
    date: new Date(entry.createdAt),
    createdAt: entry.createdAt,
    title: entry.title,
    content: entry.content,
    type: entry.type,
    tags: entry.tags,
    isFavorite: entry.isFavorite ?? decoration.isFavorite,
    tone: decoration.tone,
    icon: decoration.icon,
  };
}

export function toCalendarEntries(entries: JournalEntry[]): CalendarEntry[] {
  return entries.map(toCalendarEntry);
}
