/**
 * Curated goal icon library.
 *
 * This module is authoritative: `GOAL_ICON_KEYS` feeds the strict JSON-schema
 * enums used by both AI goal-suggestion generators, so the model picks an icon
 * inside the call it already makes (no extra request, no extra latency). The
 * frontend mirror at `frontend/src/constants/goalIcons.ts` maps these keys to
 * emoji and repeats the matcher so the goal sheet can preview an icon while the
 * user types.
 *
 * Keys are stored, never emoji — a stored key survives an emoji swap, and an
 * unknown key degrades to `target` instead of rendering tofu.
 */

export const GOAL_ICON_KEYS = [
  "target",
  "run",
  "walk",
  "gym",
  "stretch",
  "sleep",
  "water",
  "food",
  "veggie",
  "coffee",
  "meds",
  "meditate",
  "breathe",
  "therapy",
  "journal",
  "gratitude",
  "mood",
  "calm",
  "anxiety",
  "anger",
  "confidence",
  "boundaries",
  "work",
  "code",
  "study",
  "read",
  "write",
  "focus",
  "plan",
  "learn",
  "money",
  "spending",
  "family",
  "friends",
  "partner",
  "peach",
  "pet",
  "social",
  "call",
  "phone",
  "social_media",
  "alcohol",
  "smoking",
  "clean",
  "cook",
  "garden",
  "nature",
  "sun",
  "music",
  "art",
  "travel",
  "morning",
  "evening",
] as const;

export type GoalIconKey = (typeof GOAL_ICON_KEYS)[number];

export const DEFAULT_GOAL_ICON: GoalIconKey = "target";

const GENERIC_GOAL_ICON_POOL: readonly GoalIconKey[] = [
  "plan",
  "nature",
  "sun",
  "calm",
  "focus",
  "mood",
  "journal",
  "walk",
  "learn",
  "music",
  "art",
  "morning",
  "evening",
];

const GOAL_ICON_ALTERNATIVES: Partial<
  Record<GoalIconKey, readonly GoalIconKey[]>
> = {
  journal: ["write", "mood", "gratitude", "plan"],
  walk: ["nature", "sun", "run", "pet"],
  gym: ["run", "stretch", "confidence", "walk"],
  sleep: ["evening", "calm", "morning"],
  meditate: ["breathe", "calm", "nature"],
  calm: ["breathe", "nature", "music", "walk"],
  focus: ["plan", "work", "study", "learn"],
  work: ["focus", "plan", "learn"],
  study: ["read", "learn", "focus", "plan"],
  family: ["call", "social", "friends"],
  friends: ["social", "call", "family"],
  mood: ["calm", "journal", "sun", "nature"],
  food: ["cook", "veggie", "water"],
};

export const isGoalIconKey = (value: unknown): value is GoalIconKey =>
  typeof value === "string" &&
  (GOAL_ICON_KEYS as readonly string[]).includes(value);

/**
 * Multi-word phrases, checked before single tokens because they are strictly
 * more specific than any of their parts ("social media" must not land on
 * `social`, "screen time" must not land on `phone` via "time").
 */
const GOAL_ICON_PHRASES: ReadonlyArray<{
  key: GoalIconKey;
  pattern: RegExp;
}> = [
  { key: "social_media", pattern: /\bsocial media\b/ },
  { key: "phone", pattern: /\bscreen time\b/ },
  { key: "focus", pattern: /\bdeep work\b/ },
  { key: "gym", pattern: /\bstrength train\w*\b/ },
  { key: "money", pattern: /\bside hustle\b/ },
  { key: "sleep", pattern: /\bgo to bed\b/ },
  { key: "morning", pattern: /\bwake up\b/ },
  { key: "gratitude", pattern: /\bthank you\b/ },
  { key: "boundaries", pattern: /\bsay(ing)? no\b/ },
];

/**
 * Keyword table in PRIORITY ORDER — first match wins. Ordering is load-bearing:
 * the more specific key must precede the broader one it would otherwise be
 * swallowed by (`smoking`/`vape` before `breathe`, `spending` before `money`,
 * `veggie` before `food`).
 *
 * NOTE: direction of intent is deliberately ignored. "Cut down on coffee" gets
 * the coffee icon, and that is correct — the icon labels the *subject* of the
 * goal, not the user's stance on it. Do not "improve" this into negation or
 * sentiment detection; it would make icons unpredictable for no benefit.
 */
const GOAL_ICON_KEYWORDS: ReadonlyArray<{
  key: GoalIconKey;
  words: readonly string[];
}> = [
  { key: "social_media", words: ["instagram", "tiktok", "twitter", "reddit", "feed", "scroll", "scrolling"] },
  { key: "smoking", words: ["smoke", "smoking", "cigarette", "vape", "vaping", "nicotine"] },
  // water and coffee outrank alcohol because "drink" on its own is ambiguous:
  // "drink more water" must not read as an alcohol goal. A bare "cut back on
  // drinking" still falls through to alcohol.
  { key: "water", words: ["water", "hydrate", "hydration", "hydrated"] },
  { key: "coffee", words: ["coffee", "caffeine", "espresso", "latte", "cafe"] },
  { key: "alcohol", words: ["alcohol", "drink", "drinking", "beer", "wine", "sober", "sobriety", "booze"] },
  { key: "spending", words: ["spend", "spending", "budget", "expense", "shopping", "impulse"] },
  { key: "money", words: ["money", "save", "saving", "savings", "invest", "investing", "debt", "finance", "income"] },
  { key: "veggie", words: ["vegetable", "veggie", "veggies", "salad", "greens"] },
  { key: "cook", words: ["cook", "cooking", "meal", "meals", "recipe", "bake", "baking"] },
  { key: "food", words: ["eat", "eating", "food", "snack", "diet", "nutrition"] },
  { key: "sleep", words: ["sleep", "sleeping", "bedtime", "nap", "rest", "insomnia"] },
  { key: "run", words: ["run", "running", "jog", "jogging", "marathon", "sprint"] },
  { key: "walk", words: ["walk", "walking", "steps", "stroll", "hike", "hiking"] },
  { key: "gym", words: ["gym", "workout", "lift", "lifting", "exercise", "training", "fitness", "weights"] },
  { key: "stretch", words: ["stretch", "stretching", "yoga", "mobility", "pilates"] },
  { key: "meds", words: ["medication", "medicine", "pill", "pills", "vitamin", "vitamins", "supplement"] },
  { key: "meditate", words: ["meditate", "meditation", "mindfulness", "mindful"] },
  { key: "breathe", words: ["breathe", "breathing", "breath", "breathwork"] },
  { key: "therapy", words: ["therapy", "therapist", "counselling", "counseling", "counsellor", "session"] },
  { key: "journal", words: ["journal", "journaling", "diary", "entry", "entries", "reflect", "reflection"] },
  { key: "gratitude", words: ["gratitude", "grateful", "thankful", "appreciate", "appreciation"] },
  { key: "anxiety", words: ["anxiety", "anxious", "worry", "worrying", "panic", "overthink", "overthinking"] },
  { key: "anger", words: ["anger", "angry", "rage", "temper", "irritable", "frustration"] },
  { key: "calm", words: ["calm", "relax", "relaxing", "unwind", "peace", "peaceful", "slow"] },
  { key: "confidence", words: ["confidence", "confident", "esteem", "worth", "brave", "bravery", "courage"] },
  // "no" / "say" are deliberately absent — far too common to key an icon on.
  { key: "boundaries", words: ["boundary", "boundaries", "limit", "limits"] },
  { key: "mood", words: ["mood", "feeling", "feelings", "emotion", "emotions", "checkin"] },
  { key: "code", words: ["code", "coding", "program", "programming", "build", "developer", "app", "leetcode", "debug"] },
  { key: "study", words: ["study", "studying", "revise", "revision", "exam", "exams", "homework", "class"] },
  { key: "read", words: ["read", "reading", "book", "books", "chapter", "pages"] },
  { key: "write", words: ["write", "writing", "blog", "essay", "draft", "newsletter"] },
  { key: "learn", words: ["learn", "learning", "course", "practise", "practice", "skill", "language"] },
  { key: "focus", words: ["focus", "focused", "concentrate", "distraction", "distractions", "pomodoro"] },
  { key: "plan", words: ["plan", "planning", "schedule", "calendar", "week", "review", "organise", "organize"] },
  { key: "work", words: ["work", "job", "career", "meeting", "meetings", "email", "emails", "inbox", "client"] },
  { key: "partner", words: ["partner", "girlfriend", "boyfriend", "wife", "husband", "spouse", "relationship", "date"] },
  { key: "peach", words: ["sex", "intimacy", "intimate", "libido"] },
  { key: "family", words: ["family", "mum", "mom", "dad", "parent", "parents", "brother", "sister", "sibling", "kid", "kids", "son", "daughter"] },
  { key: "friends", words: ["friend", "friends", "friendship", "mate", "mates"] },
  { key: "call", words: ["call", "phonecall", "ring", "facetime"] },
  { key: "phone", words: ["phone", "screen", "notification", "notifications", "device"] },
  { key: "social", words: ["social", "party", "hangout", "meetup", "gathering", "people"] },
  { key: "pet", words: ["pet", "dog", "cat", "puppy", "kitten", "walkies"] },
  { key: "clean", words: ["clean", "cleaning", "tidy", "tidying", "declutter", "laundry", "dishes", "chore", "chores"] },
  { key: "garden", words: ["garden", "gardening", "plant", "plants", "grow", "seed", "seeds"] },
  { key: "nature", words: ["nature", "outside", "outdoors", "park", "forest", "trail", "beach"] },
  { key: "sun", words: ["sun", "sunlight", "daylight", "sunshine"] },
  { key: "music", words: ["music", "guitar", "piano", "sing", "singing", "song", "instrument", "band"] },
  { key: "art", words: ["art", "draw", "drawing", "paint", "painting", "sketch", "creative", "design"] },
  { key: "travel", words: ["travel", "trip", "flight", "holiday", "vacation", "explore"] },
];

/**
 * Weak tier — words that normally describe *when* a goal happens rather than
 * what it is about. Checked only after every strong keyword has missed, so
 * "Walk after dinner" resolves to `walk` and not `food`, while a bare
 * "Cook dinner properly" still lands somewhere sensible.
 */
const GOAL_ICON_WEAK_KEYWORDS: ReadonlyArray<{
  key: GoalIconKey;
  words: readonly string[];
}> = [
  { key: "food", words: ["breakfast", "lunch", "dinner", "supper"] },
  // "am" / "pm" are deliberately absent — "I am going to…" is not a morning goal.
  { key: "morning", words: ["morning", "sunrise", "early"] },
  { key: "evening", words: ["evening", "night", "sunset", "tonight", "bed"] },
];

const SUFFIXES = ["ing", "es", "ed", "s"] as const;

const normalizeTitle = (title: string): string =>
  title
    .toLowerCase()
    .normalize("NFD")
    // Strip combining diacritical marks so "cafés" tokenizes like "cafes".
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getStableTitleIndex = (title: string, length: number) => {
  let hash = 0;

  for (const character of normalizeTitle(title)) {
    hash = (hash * 31 + character.charCodeAt(0)) % 4_294_967_296;
  }

  return length > 0 ? hash % length : 0;
};

const resolveGenericGoalIcon = (title: string): GoalIconKey =>
  GENERIC_GOAL_ICON_POOL[
    getStableTitleIndex(title, GENERIC_GOAL_ICON_POOL.length)
  ] || "plan";

/**
 * Tokens are matched as whole words, never as substrings.
 *
 * Substring matching is the obvious implementation and it is wrong: `run` would
 * hit "brunch", `read` would hit "already", `anger` would hit "changer", `art`
 * would hit "start", and `gym` would hit "gymnastics". Token matching removes
 * that entire class of false positive.
 */
const tokenize = (normalized: string): Set<string> => {
  const tokens = new Set<string>();

  for (const token of normalized.split(" ")) {
    if (!token) {
      continue;
    }

    tokens.add(token);

    // Add *every* candidate stem rather than stopping at the first suffix that
    // matches: "vegetables" ends with both "es" and "s", and only the "s" strip
    // yields the real word. Over-generating stems is harmless because they are
    // only ever compared against the curated keyword list below.
    for (const suffix of SUFFIXES) {
      if (token.length > suffix.length + 2 && token.endsWith(suffix)) {
        tokens.add(token.slice(0, -suffix.length));
      }
    }
  }

  return tokens;
};

export const resolveGoalIcon = (title: string): GoalIconKey => {
  if (typeof title !== "string" || !title.trim()) {
    return DEFAULT_GOAL_ICON;
  }

  const normalized = normalizeTitle(title);

  if (!normalized) {
    return DEFAULT_GOAL_ICON;
  }

  for (const phrase of GOAL_ICON_PHRASES) {
    if (phrase.pattern.test(normalized)) {
      return phrase.key;
    }
  }

  const tokens = tokenize(normalized);

  for (const table of [GOAL_ICON_KEYWORDS, GOAL_ICON_WEAK_KEYWORDS]) {
    for (const entry of table) {
      for (const word of entry.words) {
        if (tokens.has(word)) {
          return entry.key;
        }
      }
    }
  }

  return resolveGenericGoalIcon(title);
};

/**
 * Returns a contextual icon that is not already used when the curated catalog
 * has another option. Explicit user choices bypass this helper.
 */
export const resolveUniqueGoalIcon = (
  title: string,
  unavailableIcons: Iterable<GoalIconKey> = [],
  preferredIcon?: unknown
): GoalIconKey => {
  const unavailable = new Set(unavailableIcons);
  const preferred = isGoalIconKey(preferredIcon) && preferredIcon !== "target"
    ? preferredIcon
    : resolveGoalIcon(title);

  if (!unavailable.has(preferred)) {
    return preferred;
  }

  for (const alternative of GOAL_ICON_ALTERNATIVES[preferred] || []) {
    if (!unavailable.has(alternative)) {
      return alternative;
    }
  }

  const candidates = GOAL_ICON_KEYS.filter((key) => key !== "target");
  const start = getStableTitleIndex(title, candidates.length);

  for (let offset = 0; offset < candidates.length; offset += 1) {
    const candidate = candidates[(start + offset) % candidates.length];

    if (candidate && !unavailable.has(candidate)) {
      return candidate;
    }
  }

  return preferred;
};

/** Coerces any stored/incoming value into a renderable key. */
export const normalizeGoalIcon = (
  value: unknown,
  fallbackTitle?: string
): GoalIconKey => {
  if (isGoalIconKey(value)) {
    return value;
  }

  return fallbackTitle ? resolveGoalIcon(fallbackTitle) : DEFAULT_GOAL_ICON;
};
