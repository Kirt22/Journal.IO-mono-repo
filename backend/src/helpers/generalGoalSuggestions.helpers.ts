import type { GoalIconKey } from "./goalIcons.helpers";
import type { GoalFrequency } from "./goalPeriod.helpers";
import { analyzeJournalTextQuality } from "./journalTextQuality.helpers";
import type { GoalSuggestionCategory } from "../types/goals.types";

/**
 * A "general" entry is one with nothing specific enough to ground a tailored
 * goal in — either genuinely thin, or long but vague. Those entries get the
 * baseline bank below instead of invented specifics.
 */
export type GoalSignalLevel = "general" | "specific";

export type GoalDomain =
  | "work"
  | "study"
  | "sleep"
  | "money"
  | "health"
  | "movement"
  | "food"
  | "partner"
  | "family"
  | "friends"
  | "conflict"
  | "substances"
  | "screens"
  | "home";

export type GoalSignalAssessment = {
  level: GoalSignalLevel;
  domains: GoalDomain[];
  wordCount: number;
  /** How much there is to anchor a tailored goal in. See `assessGoalSignal`. */
  specificityScore: number;
};

export type BaselineGoal = {
  title: string;
  description: string;
  icon: GoalIconKey;
  frequency: GoalFrequency;
  category: GoalSuggestionCategory;
  /** Used only to reorder the bank against what the entry actually mentions. */
  themes: ReadonlyArray<"movement" | "sleep" | "stress" | "connection" | "fuel">;
};

/** Below this there is not enough text to carry any goal. */
const GENERAL_MIN_WORDS = 8;
/** At or below this specificity score nothing tailored can be grounded. */
const GENERAL_MAX_SCORE = 1;

const DOMAIN_PATTERNS: ReadonlyArray<[GoalDomain, RegExp]> = [
  [
    "work",
    /\b(work|working|job|boss|manager|deadline|meeting|client|shift|project|career|interview|colleague|coworker|office)\b/,
  ],
  [
    "study",
    /\b(study|studying|exam|exams|class|classes|course|assignment|revision|school|college|university|degree|thesis)\b/,
  ],
  // "tired" and "exhausted" live in TIREDNESS_PATTERN instead: they are states,
  // not evidence that the entry is actually about sleep.
  ["sleep", /\b(sleep|slept|sleeping|insomnia|awake|nap|bedtime|restless)\b/],
  [
    "money",
    /\b(money|rent|bill|bills|budget|debt|salary|saving|savings|afford|expensive|broke|invoice)\b/,
  ],
  [
    "health",
    /\b(doctor|illness|injury|injured|headache|migraine|therapy|therapist|medication|meds|diagnosis|symptom)\b/,
  ],
  [
    "movement",
    /\b(gym|run|running|ran|walk|walked|walking|workout|exercise|training|yoga|stretch|steps|swim|cycling)\b/,
  ],
  [
    "food",
    /\b(eat|eating|ate|meal|meals|breakfast|lunch|dinner|cook|cooking|diet|hungry|snack|groceries)\b/,
  ],
  [
    "partner",
    /\b(partner|boyfriend|girlfriend|husband|wife|spouse|relationship|dating|breakup|marriage)\b/,
  ],
  [
    "family",
    /\b(family|mum|mom|dad|mother|father|parent|parents|sister|brother|son|daughter|kids|grandma|grandpa)\b/,
  ],
  [
    "friends",
    /\b(friend|friends|mate|mates|party|hangout|lonely|alone|isolated|neighbour|neighbor)\b/,
  ],
  [
    "conflict",
    /\b(argument|argued|fight|fought|conflict|angry|anger|upset|annoyed|frustrated|resent|shouted)\b/,
  ],
  [
    "substances",
    /\b(drink|drinking|drank|alcohol|beer|wine|smoke|smoking|vape|weed|caffeine|hungover)\b/,
  ],
  [
    "screens",
    /\b(phone|scroll|scrolling|instagram|tiktok|twitter|youtube|reddit|screen|screens|netflix)\b/,
  ],
  [
    "home",
    /\b(house|flat|apartment|cleaning|tidy|laundry|dishes|chores|clutter|moving)\b/,
  ],
];

const VAGUE_MARKERS: ReadonlyArray<RegExp> = [
  /\bfine\b/,
  /\b(okay|ok)\b/,
  /\bmeh\b/,
  /\bnothing much\b/,
  /\bnothing (really )?happened\b/,
  /\bsame as usual\b/,
  /\bsame old\b/,
  /\bnormal day\b/,
  /\bas usual\b/,
  /\bidk\b/,
  /\bi don'?t know\b/,
  /\bwhatever\b/,
  /\bnot much\b/,
  /\bblah\b/,
  /\bboring\b/,
  /\bjust another day\b/,
  /\balright\b/,
];

const EMOTION_PATTERN =
  /\b(happy|sad|angry|anxious|anxiety|stress|stressed|scared|afraid|guilty|ashamed|proud|excited|lonely|hurt|heavy|numb|overwhelmed|frustrated|grateful|relieved|tired|exhausted|drained|nervous|calm|jealous|resentful)\b/;
/** An explicit want or intent is something a goal can be built on. */
const INTENT_PATTERN =
  /\b(i want|i need|i should|i have to|i'?m going to|im going to|trying to|hoping to|hope to|plan to|planning to|need to|want to|planning on)\b/;
/** A named time or quantity makes an action schedulable. */
const SPECIFIC_TIME_PATTERN =
  /\b(tomorrow|tonight|this week|next week|this weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|evening|\d+\s*(?:am|pm|minutes?|hours?|days?|weeks?))\b/;

const TIREDNESS_PATTERN = /\b(tired|exhausted|drained|no energy|sleep|insomnia)\b/;
const STRESS_PATTERN =
  /\b(stress\w*|overwhelm\w*|anxious|anxiety|pressure|tense|worried|racing)\b/;
const LONELINESS_PATTERN =
  /\b(lonely|alone|isolated|no one|nobody|disconnected|left out)\b/;

/**
 * What a supportive coach falls back to when nothing specific stands out: move
 * the body first, then sleep, daylight, fuel, and one point of human contact.
 * Every title stays within 30 characters and every description within 96 so the
 * same objects are valid on both the entry and the guided-reflection paths.
 */
export const GENERAL_BASELINE_GOALS: ReadonlyArray<BaselineGoal> = [
  {
    title: "Walk 20 minutes",
    description: "Get outside for a 20-minute walk, even when the day feels flat.",
    icon: "walk",
    frequency: "daily",
    category: "general",
    themes: ["movement", "stress"],
  },
  {
    title: "Hit 5,000 steps",
    description: "Aim for 5,000 steps by evening; short walks through the day count.",
    icon: "run",
    frequency: "daily",
    category: "general",
    themes: ["movement"],
  },
  {
    title: "Train twice this week",
    description: "Book two gym or workout sessions on named days this week.",
    icon: "gym",
    frequency: "weekly",
    category: "general",
    themes: ["movement"],
  },
  {
    title: "Stretch 5 minutes at night",
    description: "Loosen up with five minutes of stretching before bed.",
    icon: "stretch",
    frequency: "daily",
    category: "sleep",
    themes: ["movement", "sleep"],
  },
  {
    title: "Wake at the same time",
    description: "Keep one wake-up time for a week, weekends included.",
    icon: "sleep",
    frequency: "daily",
    category: "sleep",
    themes: ["sleep"],
  },
  {
    title: "Screens off 30 min early",
    description: "Put your phone down half an hour before bed.",
    icon: "social_media",
    frequency: "daily",
    category: "sleep",
    themes: ["sleep"],
  },
  {
    title: "Get 10 minutes of sun",
    description: "Step outside for ten minutes of daylight in the morning.",
    icon: "sun",
    frequency: "daily",
    category: "mood",
    themes: ["movement", "stress"],
  },
  {
    title: "Step outside at lunch",
    description: "Take your lunch break outdoors instead of at your desk.",
    icon: "nature",
    frequency: "daily",
    category: "stress",
    themes: ["stress", "movement"],
  },
  {
    title: "Drink water first thing",
    description: "Start the day with a full glass of water before coffee.",
    icon: "water",
    frequency: "daily",
    category: "general",
    themes: ["fuel"],
  },
  {
    title: "Eat one real meal",
    description: "Sit down for one proper meal instead of eating on the move.",
    icon: "food",
    frequency: "daily",
    category: "general",
    themes: ["fuel"],
  },
  {
    title: "Message one person",
    description: "Reach out to one friend or family member you have not spoken to.",
    icon: "friends",
    frequency: "weekly",
    category: "relationships",
    themes: ["connection"],
  },
  {
    title: "Take 2 slow-breath minutes",
    description: "Pause once a day for two minutes of slow, steady breathing.",
    icon: "breathe",
    frequency: "daily",
    category: "stress",
    themes: ["stress"],
  },
];

/**
 * Classifies how much the entry gives us to work with. Length alone is the wrong
 * measure — a long entry can still be "work was work, same as usual" — so this
 * scores what a goal could actually be anchored to: named life areas, a felt
 * state, a stated want, and a schedulable time. Builds on
 * `analyzeJournalTextQuality` so noise and prompt echo are already stripped.
 */
export const assessGoalSignal = (
  text: string | null | undefined
): GoalSignalAssessment => {
  const quality = analyzeJournalTextQuality({ content: String(text || "") });
  const comparable = quality.strippedText.toLowerCase();
  const domains = DOMAIN_PATTERNS.filter(([, pattern]) =>
    pattern.test(comparable)
  ).map(([domain]) => domain);
  const vagueMarkers = VAGUE_MARKERS.filter((pattern) =>
    pattern.test(comparable)
  ).length;
  const wordCount = quality.analysisWordCount;

  const specificityScore =
    Math.min(domains.length, 3) +
    (EMOTION_PATTERN.test(comparable) ? 1 : 0) +
    (INTENT_PATTERN.test(comparable) ? 1 : 0) +
    (SPECIFIC_TIME_PATTERN.test(comparable) ? 1 : 0);

  const isGeneral =
    quality.lowSignalDetected ||
    wordCount < GENERAL_MIN_WORDS ||
    specificityScore <= GENERAL_MAX_SCORE ||
    // Long but hedged: plenty of words, almost nothing said.
    (vagueMarkers >= 2 && specificityScore <= 2);

  return {
    level: isGeneral ? "general" : "specific",
    domains,
    wordCount,
    specificityScore,
  };
};

/** Bank entries as the API returns them — `themes` is an internal sort key. */
export type GeneralGoalSuggestion = Omit<BaselineGoal, "themes">;

/**
 * The baseline bank, lightly reordered toward what the entry does mention.
 * Movement stays first when nothing points elsewhere.
 */
export const buildGeneralBaselineGoals = (
  text: string | null | undefined,
  limit: number
): GeneralGoalSuggestion[] => {
  const comparable = String(text || "").toLowerCase();
  const focus = new Set<BaselineGoal["themes"][number]>();

  if (TIREDNESS_PATTERN.test(comparable)) {
    focus.add("sleep");
  }

  if (STRESS_PATTERN.test(comparable)) {
    focus.add("stress");
  }

  if (LONELINESS_PATTERN.test(comparable)) {
    focus.add("connection");
  }

  const score = (goal: BaselineGoal) =>
    goal.themes.some((theme) => focus.has(theme)) ? 1 : 0;

  // Sort is stable in Node, so equally scored goals keep the movement-first order.
  return [...GENERAL_BASELINE_GOALS]
    .sort((left, right) => score(right) - score(left))
    .slice(0, Math.max(limit, 0))
    .map(({ themes: _themes, ...goal }) => goal);
};

/** The entry endpoint's contract has no `category`, so it is dropped here. */
export const buildEntryBaselineGoals = (
  text: string | null | undefined,
  limit: number
): Array<Omit<GeneralGoalSuggestion, "category">> =>
  buildGeneralBaselineGoals(text, limit).map((goal) => ({
    title: goal.title,
    description: goal.description,
    icon: goal.icon,
    frequency: goal.frequency,
  }));
