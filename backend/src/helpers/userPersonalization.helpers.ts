import {
  IOnboardingContext,
  IOnboardingPayload,
  IStructuredGoal,
  userModel,
} from "../schema/user.schema";

/**
 * The onboarding answers, reshaped for a prompt.
 *
 * This is what the model sees under `userProfile`. Every field is optional:
 * onboarding is skippable, older accounts predate most of these questions, and
 * a partial profile is still worth sending.
 */
type UserPromptProfile = {
  preferredName?: string;
  ageRange?: string;
  lifeContext?: string;
  reflectionTone?: string;
  focusAreas?: string[];
  journalingGoals?: string[];
  activeGoals?: string[];
};

type UserPersonalization = {
  /** Goes in the user JSON, alongside `longTermMemory`. */
  promptProfile: UserPromptProfile;
  /** Appended to the system message. */
  systemDirective: string;
};

/**
 * The subset of the user document personalization reads. Kept structural rather
 * than `IUser` so the pure builders can be called with a `.lean()` result or a
 * plain fixture in tests.
 */
type PersonalizationSource = {
  name?: string | null;
  onboardingPayload?: IOnboardingPayload | null;
  onboardingContext?: IOnboardingContext | null;
  journalingGoals?: string[] | null;
  goals?: IStructuredGoal[] | null;
};

const PERSONALIZATION_SELECT =
  "name onboardingPayload onboardingContext journalingGoals goals";

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ACTIVE_GOALS = 5;
const MAX_LIST_ITEMS = 6;

/**
 * Onboarding stores option *ids*, not labels, and the two flows use different
 * id sets for the same questions (V1 `"self-awareness"` vs V2 `"low_mood"`).
 * Raw ids read as noise in a prompt, so both sets are mapped here.
 *
 * Unknown values fall through to `humanizeOnboardingValue`, which means a new
 * option id — or a free-text answer — degrades to a readable phrase instead of
 * disappearing. That is deliberate: this map going stale must never silently
 * drop a user's answer.
 */
const ONBOARDING_LABELS: Record<string, string> = {
  // Age ranges (V2 ids; V1 already stores display strings like "25-34").
  "18_24": "18-24",
  "25_34": "25-34",
  "35_44": "35-44",
  "45_plus": "45+",
  prefer_not_to_say: "Prefers not to say",

  // Life context — V2 "what do you do most days".
  student: "Student",
  working_professional: "Working professional",
  founder_builder: "Founder / building something",
  creative_work: "Creative work",
  looking_for_work: "Looking for work",
  other_prefer_not: "Prefers not to say",

  // Life context — V1 journaling experience.
  new: "New to journaling",
  occasional: "Occasional journaler",
  regular: "Regular journaler",
  daily: "Daily journaler",

  // Reflection tone (V2).
  gentle: "Gentle",
  direct: "Direct",
  deep: "Deep",
  motivating: "Motivating",
  neutral: "Neutral",

  // Support focus — V2.
  stress: "Stress",
  overthinking: "Overthinking",
  low_mood: "Low mood",
  loneliness: "Loneliness",
  anger: "Anger",
  focus: "Focus",

  // Support focus — V1.
  anxiety: "Reducing worry",
  sleep: "Better sleep",
  relationships: "Relationships",
  "self-awareness": "Self-awareness",

  // Journaling goals — V1.
  reflection: "Daily reflection",
  mindfulness: "Mindfulness practice",
  growth: "Personal growth",
  gratitude: "Gratitude journaling",
  support: "Supportive check-ins",
  habits: "Habit tracking",
};

/**
 * Tone instructions, keyed on the normalized reflection-tone id.
 *
 * `neutral` is intentionally absent — it means "no steer", and adding a line
 * saying so would only dilute the rest of the system prompt.
 */
const TONE_DIRECTIVES: Record<string, string> = {
  gentle:
    "This person asked for a gentle tone: stay soft and steady, soften confrontation, and lead with care — but still name what you actually see.",
  direct:
    "This person asked for a direct tone: be plain-spoken, skip the cushioning, and state the observation clearly without being harsh.",
  deep: "This person asked for a deep tone: go a layer under the surface event and prioritize the underlying pattern over the immediate detail.",
  motivating:
    "This person asked for a motivating tone: stay forward-looking and anchor the next step in something concrete they could act on today.",
};

const PROFILE_GUARDRAIL =
  "userProfile describes who this person is, taken from their onboarding answers. Use it to choose emphasis, examples, vocabulary, and tone. Never quote it back at them or mention that you have it. A stated focus area is a topic they care about — it is not a diagnosis and not evidence that it is present in this entry. Never let the profile override what they actually wrote.";

const humanizeOnboardingValue = (value: string) => {
  // A hyphen between two digits is a range ("35-44" — V1 stores age ranges as
  // display strings), not a slug separator, so it has to survive.
  const spaced = value
    .replace(/_+/g, " ")
    .replace(/(?<=\D)-+|-+(?=\D)|^-+|-+$/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (!spaced) {
    return "";
  }

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const toLabel = (value?: string | null) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return ONBOARDING_LABELS[trimmed] || humanizeOnboardingValue(trimmed);
};

const toLabelList = (values?: string[] | null) => {
  const labels = Array.from(
    new Set(
      (values || [])
        .map((value) => toLabel(value))
        .filter((label): label is string => Boolean(label))
    )
  ).slice(0, MAX_LIST_ITEMS);

  return labels.length > 0 ? labels : undefined;
};

/** First name only — the prompt wants a name to address, not a legal identity. */
const toPreferredName = (name?: string | null) => {
  const firstName = name?.trim().split(/\s+/)[0];

  return firstName || undefined;
};

const toActiveGoalTitles = (goals?: IStructuredGoal[] | null) => {
  const titles = (goals || [])
    .filter((goal) => goal?.status === "active")
    .map((goal) => goal?.title?.trim())
    .filter((title): title is string => Boolean(title))
    .slice(0, MAX_ACTIVE_GOALS);

  return titles.length > 0 ? titles : undefined;
};

/**
 * Merges the two storage shapes into one prompt profile.
 *
 * `onboardingPayload` is the current store and wins; `onboardingContext` is the
 * legacy shape still written by the signup path (`auth.service`), so it fills
 * the gaps for accounts that never reached `/onboarding/complete`. This mirrors
 * the precedence in `buildLegacyOnboardingContext`
 * (`services/onboarding/onboarding.service.ts`).
 */
const buildUserPromptProfile = (
  user: PersonalizationSource
): UserPromptProfile => {
  const payload = user.onboardingPayload;
  const context = user.onboardingContext;

  const profile: UserPromptProfile = {};

  const preferredName = toPreferredName(user.name);
  const ageRange = toLabel(payload?.ageRange || context?.ageRange);
  const lifeContext = toLabel(
    payload?.primaryContext || context?.journalingExperience
  );
  const reflectionTone = toLabel(payload?.reflectionTone?.[0]);
  const focusAreas = toLabelList(
    payload?.supportFocusAreas?.length
      ? payload.supportFocusAreas
      : context?.supportFocus
  );
  const journalingGoals = toLabelList(
    payload?.personalGoals?.length ? payload.personalGoals : user.journalingGoals
  );
  const activeGoals = toActiveGoalTitles(user.goals);

  if (preferredName) {
    profile.preferredName = preferredName;
  }

  if (ageRange) {
    profile.ageRange = ageRange;
  }

  if (lifeContext) {
    profile.lifeContext = lifeContext;
  }

  if (reflectionTone) {
    profile.reflectionTone = reflectionTone;
  }

  if (focusAreas) {
    profile.focusAreas = focusAreas;
  }

  if (journalingGoals) {
    profile.journalingGoals = journalingGoals;
  }

  if (activeGoals) {
    profile.activeGoals = activeGoals;
  }

  return profile;
};

/**
 * Accepts either the stored id (`"direct"`) or its display label (`"Direct"`),
 * so a merged profile keeps its tone steer regardless of which side supplied it.
 */
const getToneDirective = (tone?: string | null) => {
  const toneId = tone?.trim().toLowerCase();

  return toneId ? TONE_DIRECTIVES[toneId] : undefined;
};

/** Wraps the tone steer with the guardrail that must accompany any profile. */
const buildPersonalizationDirective = (tone?: string | null) =>
  [getToneDirective(tone), PROFILE_GUARDRAIL].filter(Boolean).join(" ");

/**
 * Returns `null` when there is nothing personal to say — a brand-new account,
 * or one whose only signal is a display name. Call sites inject nothing in that
 * case rather than sending an empty object the model has to reason about.
 */
const buildPersonalizationFromUser = (
  user: PersonalizationSource | null | undefined
): UserPersonalization | null => {
  if (!user) {
    return null;
  }

  const promptProfile = buildUserPromptProfile(user);
  const hasSubstance = Object.keys(promptProfile).some(
    (key) => key !== "preferredName"
  );

  if (!hasSubstance) {
    return null;
  }

  return {
    promptProfile,
    systemDirective: buildPersonalizationDirective(
      user.onboardingPayload?.reflectionTone?.[0]
    ),
  };
};

type CacheEntry = {
  value: UserPersonalization | null;
  expiresAt: number;
};

/**
 * A single insights refresh fans out to several AI calls for the same user, and
 * this profile changes only at onboarding or profile edit. Cached for five
 * minutes to keep that from becoming N identical queries.
 */
const personalizationCache = new Map<string, CacheEntry>();

const invalidateUserPersonalizationCache = (userId: string) => {
  personalizationCache.delete(String(userId));
};

const clearUserPersonalizationCache = () => {
  personalizationCache.clear();
};

const buildUserPersonalization = async (
  userId: string
): Promise<UserPersonalization | null> => {
  const cacheKey = String(userId);
  const cached = personalizationCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const user = await userModel
      .findById(userId)
      .select(PERSONALIZATION_SELECT)
      .lean<PersonalizationSource | null>()
      .exec();

    const value = buildPersonalizationFromUser(user);

    personalizationCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return value;
  } catch (error) {
    // Personalization is an enhancement, never a precondition. A failed lookup
    // must not take down the AI call it was meant to improve.
    console.error("Failed to build user personalization:", error);

    return null;
  }
};

export {
  buildPersonalizationDirective,
  buildPersonalizationFromUser,
  buildUserPersonalization,
  buildUserPromptProfile,
  clearUserPersonalizationCache,
  getToneDirective,
  humanizeOnboardingValue,
  invalidateUserPersonalizationCache,
  PROFILE_GUARDRAIL,
  toLabel as toOnboardingLabel,
  toLabelList as toOnboardingLabelList,
  TONE_DIRECTIVES,
};
export type { UserPersonalization, UserPromptProfile };
