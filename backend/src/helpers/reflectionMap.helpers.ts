import { z } from "zod";

export type ReflectionRegionId =
  | "emotional_intensity"
  | "planning_self_control"
  | "memory_meaning"
  | "body_inner_signals"
  | "conflict_attention"
  | "motivation_reward"
  | "relationships_perspective"
  | "self_reflection_identity";

export type ReflectionRegionTrend = "rising" | "steady" | "easing";

export type ReflectionRegionIntensity = "low" | "moderate" | "high";

// How strongly a region shows up compared with a typical reflector. Bands only
// — never a number, percentile, or clinical judgement.
export type ReflectionRegionTier = "low" | "balanced" | "high" | "very_high";

export type OverallReflectionTierId =
  | "emerging"
  | "balanced"
  | "deeply_reflective"
  | "highly_attuned";

export type OverallReflectionTier = {
  tier: OverallReflectionTierId;
  label: string;
  blurb: string;
};

export type ReflectionRegionNuancedDetails = {
  emotionalTone?: string | undefined;
  cognitivePattern?: string | undefined;
  timeOrientation?: "past" | "present" | "future" | "mixed" | undefined;
  selfOtherFocus?: "self" | "others" | "mixed" | undefined;
  actionOrientation?:
    | "reflecting"
    | "planning"
    | "avoiding"
    | "processing"
    | "acting"
    | undefined;
  repeatedSignal?: string | undefined;
};

export type ReflectionRegionScore = {
  id: ReflectionRegionId;
  productName: string;
  brainRegion: string;
  score: number;
  confidence: number;
  rank: number;
  intensity: ReflectionRegionIntensity;
  evidence: string[];
  shortInsight: string;
  // A single practical, non-clinical next step for this region. Personalised by
  // AI when available, otherwise the deterministic REFLECTION_REGION_FOCUS_TIPS.
  actionStep: string;
  nuancedDetails: ReflectionRegionNuancedDetails;
};

export const REFLECTION_REGION_IDS: ReflectionRegionId[] = [
  "emotional_intensity",
  "planning_self_control",
  "memory_meaning",
  "body_inner_signals",
  "conflict_attention",
  "motivation_reward",
  "relationships_perspective",
  "self_reflection_identity",
];

export const REFLECTION_REGION_DETAILS: Record<
  ReflectionRegionId,
  {
    productName: string;
    brainRegion: string;
    lowSignalScore: number;
  }
> = {
  emotional_intensity: {
    productName: "Emotional Intensity",
    brainRegion: "Amygdala",
    lowSignalScore: 0.22,
  },
  planning_self_control: {
    productName: "Planning & Self-Control",
    brainRegion: "Prefrontal Cortex",
    lowSignalScore: 0.45,
  },
  memory_meaning: {
    productName: "Memory & Meaning",
    brainRegion: "Hippocampus",
    lowSignalScore: 0.35,
  },
  body_inner_signals: {
    productName: "Body & Inner Signals",
    brainRegion: "Insula",
    lowSignalScore: 0.18,
  },
  conflict_attention: {
    productName: "Conflict & Attention",
    brainRegion: "Anterior Cingulate Cortex",
    lowSignalScore: 0.24,
  },
  motivation_reward: {
    productName: "Motivation & Reward",
    brainRegion: "Reward Circuit / Ventral Striatum",
    lowSignalScore: 0.2,
  },
  relationships_perspective: {
    productName: "Relationships & Perspective",
    brainRegion: "Social Brain / Temporoparietal Junction",
    lowSignalScore: 0.26,
  },
  self_reflection_identity: {
    productName: "Self-Reflection & Identity",
    brainRegion: "Default Mode Network",
    lowSignalScore: 0.55,
  },
};

/**
 * What each region means in everyday words — the vocabulary the Mind Map copy
 * uses to explain why an area lit up.
 *
 * Without this a prompt only ever sees `planning_self_control — Planning &
 * Self-Control (Prefrontal Cortex)`, so the best it can do is paraphrase the
 * label back ("this region stood out through direction, restraint, or
 * next-step thinking"). That sentence fits everyone and tells nobody anything.
 *
 * Each line is drafted from that region's own entries in
 * REFLECTION_REGION_SIGNAL_RULES below, so the explanation matches the writing
 * that actually moves the score rather than a marketing description of it.
 * Deliberately plain: no clinical vocabulary, because the whole point is that a
 * person reads this and recognises their own week in it.
 */
export const REFLECTION_REGION_PLAIN_MEANING: Record<ReflectionRegionId, string> = {
  emotional_intensity:
    "how hard things are hitting you — stress, pressure, worry, anger, feeling overwhelmed",
  planning_self_control:
    "routines, discipline and self-control — sticking to habits, making decisions, working out what to do next",
  memory_meaning:
    "looking backwards — the past, old memories, things that keep happening again, working out what it all meant",
  body_inner_signals:
    "your body — sleep, tiredness, energy, hunger, tension, physical stuff you notice",
  conflict_attention:
    "being pulled two ways — feeling torn or stuck, guilt, doubt, two things that don't fit together",
  motivation_reward:
    "wanting things and chasing them — progress, wins, staying consistent, cravings, what feels worth the effort",
  relationships_perspective:
    "other people — family, friends, a partner, feeling judged or seen, how you show up for them",
  self_reflection_identity:
    "thinking about yourself — who you are, who you're turning into, your values, proving something",
};

const REFLECTION_REGION_SIGNAL_RULES: Record<
  ReflectionRegionId,
  Array<{ terms: string[]; weight: number }>
> = {
  emotional_intensity: [
    { terms: ["stress", "stressful", "overwhelm", "overwhelmed"], weight: 0.22 },
    { terms: ["anger", "angry", "mad", "furious", "fear", "afraid"], weight: 0.22 },
    { terms: ["pressure", "pressured", "worried", "worry", "urgent"], weight: 0.18 },
    { terms: ["heavy", "threat", "panic", "anxious"], weight: 0.16 },
  ],
  planning_self_control: [
    { terms: ["discipline", "disciplined", "self-control", "control"], weight: 0.26 },
    { terms: ["tomorrow", "carry forward", "next step", "action"], weight: 0.22 },
    { terms: ["goal", "plan", "decision", "decide", "choice"], weight: 0.2 },
    { terms: ["routine", "habit", "focus", "focused", "protect my morning"], weight: 0.18 },
  ],
  memory_meaning: [
    { terms: ["remember", "memory", "memories", "past", "before"], weight: 0.22 },
    { terms: ["childhood", "old", "again", "repeated", "keeps happening"], weight: 0.2 },
    { terms: ["lesson", "meaning", "history", "used to"], weight: 0.18 },
  ],
  body_inner_signals: [
    { terms: ["tired", "exhausted", "drained", "sleep", "slept"], weight: 0.24 },
    { terms: ["energy", "body", "physical", "gut", "stomach"], weight: 0.22 },
    { terms: ["hungry", "food", "diet", "pain", "tense"], weight: 0.18 },
  ],
  conflict_attention: [
    { terms: ["guilt", "guilty", "stuck", "torn", "mixed feelings"], weight: 0.24 },
    { terms: ["uncertain", "unsure", "doubt", "contradiction"], weight: 0.22 },
    { terms: ["tension", "conflict", "but", "without turning"], weight: 0.16 },
  ],
  motivation_reward: [
    { terms: ["win", "wins", "progress", "momentum", "excited"], weight: 0.22 },
    { terms: ["stuck to", "consistent", "consistency", "effort"], weight: 0.2 },
    { terms: ["reward", "craving", "cravings", "proud", "motivated"], weight: 0.2 },
  ],
  relationships_perspective: [
    { terms: ["dad", "mom", "parent", "family", "brother", "sister"], weight: 0.26 },
    { terms: ["friend", "partner", "relationship", "people"], weight: 0.22 },
    { terms: ["judged", "seen", "belonging", "perception", "empathy"], weight: 0.2 },
  ],
  self_reflection_identity: [
    { terms: ["myself", "self", "self-image", "identity", "who I am"], weight: 0.24 },
    { terms: ["becoming", "values", "purpose", "growth", "better"], weight: 0.22 },
    { terms: ["inner", "prove", "proving", "alignment", "personal"], weight: 0.18 },
  ],
};

export const normalizeReflectionMapText = (value: string, limit = 900) =>
  value.trim().replace(/\s+/g, " ").slice(0, limit);

const clampSignal = (value: number, fallback = 0) => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, Number(value.toFixed(2))));
};

const getReflectionRegionIntensity = (score: number): ReflectionRegionIntensity => {
  if (score >= 0.67) {
    return "high";
  }

  if (score >= 0.34) {
    return "moderate";
  }

  return "low";
};

export const getReflectionEvidenceComparableText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const getReflectionRegionTerms = (id: ReflectionRegionId) =>
  REFLECTION_REGION_SIGNAL_RULES[id].flatMap(rule => rule.terms);

const getSnippetFromSentence = (sentence: string, term: string) => {
  const words = sentence.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];

  if (!words.length) {
    return "";
  }

  const comparableWords = words.map(getReflectionEvidenceComparableText);
  const termWords = getReflectionEvidenceComparableText(term).split(" ").filter(Boolean);
  let matchIndex = comparableWords.findIndex(word => termWords.includes(word));

  if (termWords.length > 1) {
    const phrase = termWords.join(" ");
    const joined = comparableWords.join(" ");
    const phraseIndex = joined.indexOf(phrase);

    if (phraseIndex >= 0) {
      const prefix = joined.slice(0, phraseIndex).trim();
      matchIndex = prefix ? prefix.split(" ").length : 0;
    }
  }

  if (matchIndex < 0) {
    matchIndex = 0;
  }

  const start = Math.max(0, matchIndex - 1);
  const end = Math.min(words.length, Math.max(matchIndex + termWords.length + 2, start + 2));

  return words.slice(start, Math.min(end, start + 6)).join(" ");
};

export const extractReflectionEvidenceSnippets = (
  userWriting: string,
  id: ReflectionRegionId,
  limit = 3
) => {
  const comparableWriting = getReflectionEvidenceComparableText(userWriting);

  if (!comparableWriting) {
    return [];
  }

  const sentences = userWriting
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
  const snippets: string[] = [];

  for (const term of getReflectionRegionTerms(id)) {
    const comparableTerm = getReflectionEvidenceComparableText(term);

    if (!comparableTerm || !comparableWriting.includes(comparableTerm)) {
      continue;
    }

    const sentence =
      sentences.find(item => getReflectionEvidenceComparableText(item).includes(comparableTerm)) ||
      userWriting;
    const snippet = getSnippetFromSentence(sentence, term);

    if (
      snippet &&
      !snippets.some(
        item =>
          getReflectionEvidenceComparableText(item) ===
          getReflectionEvidenceComparableText(snippet)
      )
    ) {
      snippets.push(snippet);
    }

    if (snippets.length >= limit) {
      break;
    }
  }

  return snippets;
};

export const sanitizeReflectionEvidence = (
  evidence: string[],
  userWriting: string,
  limit = 3
) => {
  const comparableWriting = getReflectionEvidenceComparableText(userWriting);
  const sanitized: string[] = [];

  if (!comparableWriting) {
    return sanitized;
  }

  for (const item of evidence) {
    const snippet = normalizeReflectionMapText(item, 80);
    const comparableSnippet = getReflectionEvidenceComparableText(snippet);

    if (
      comparableSnippet &&
      comparableWriting.includes(comparableSnippet) &&
      !sanitized.some(
        value => getReflectionEvidenceComparableText(value) === comparableSnippet
      )
    ) {
      sanitized.push(snippet);
    }

    if (sanitized.length >= limit) {
      break;
    }
  }

  return sanitized;
};

const detectTimeOrientation = (
  text: string
): ReflectionRegionNuancedDetails["timeOrientation"] => {
  const comparable = getReflectionEvidenceComparableText(text);
  const hasPast = /\b(yesterday|past|before|remember|childhood|old)\b/.test(comparable);
  const hasFuture = /\b(tomorrow|next|future|plan|goal|carry)\b/.test(comparable);

  if (hasPast && hasFuture) {
    return "mixed";
  }

  if (hasPast) {
    return "past";
  }

  if (hasFuture) {
    return "future";
  }

  return "present";
};

const detectSelfOtherFocus = (
  text: string,
  id: ReflectionRegionId
): ReflectionRegionNuancedDetails["selfOtherFocus"] => {
  const comparable = getReflectionEvidenceComparableText(text);
  const hasOthers = /\b(dad|mom|friend|partner|family|people|judged|seen|relationship)\b/.test(
    comparable
  );
  const hasSelf = /\b(i|me|my|myself|self|identity|becoming|values)\b/.test(comparable);

  if (id === "relationships_perspective") {
    return hasSelf ? "mixed" : "others";
  }

  if (hasOthers && hasSelf) {
    return "mixed";
  }

  return hasOthers ? "others" : "self";
};

const getActionOrientation = (
  id: ReflectionRegionId
): NonNullable<ReflectionRegionNuancedDetails["actionOrientation"]> => {
  if (id === "planning_self_control") {
    return "planning";
  }

  if (id === "motivation_reward") {
    return "acting";
  }

  if (id === "emotional_intensity" || id === "conflict_attention") {
    return "processing";
  }

  return "reflecting";
};

const buildNuancedDetails = (
  id: ReflectionRegionId,
  userWriting: string,
  evidence: string[]
): ReflectionRegionNuancedDetails => {
  const repeatedSignal = evidence[0] || "";

  const detailByCenter: Record<
    ReflectionRegionId,
    Pick<ReflectionRegionNuancedDetails, "emotionalTone" | "cognitivePattern">
  > = {
    emotional_intensity: {
      emotionalTone: "The writing carries some emotional charge or pressure.",
      cognitivePattern: "The mind appears to be tracking urgency, stress, or threat response.",
    },
    planning_self_control: {
      emotionalTone: "The tone leans toward steadiness and direction.",
      cognitivePattern: "The reflection organizes around choices, restraint, and next actions.",
    },
    memory_meaning: {
      emotionalTone: "The tone holds a meaning-making quality.",
      cognitivePattern: "The writing connects present experience with past moments or lessons.",
    },
    body_inner_signals: {
      emotionalTone: "The tone is grounded in the body's internal signals.",
      cognitivePattern: "The reflection notices energy, sleep, food, or physical state.",
    },
    conflict_attention: {
      emotionalTone: "The tone suggests competing feelings or unresolved tension.",
      cognitivePattern: "Attention appears split between two possible readings or choices.",
    },
    motivation_reward: {
      emotionalTone: "The tone includes momentum, reward, or reinforcement.",
      cognitivePattern: "The reflection tracks progress, effort, or what felt worth repeating.",
    },
    relationships_perspective: {
      emotionalTone: "The tone includes social awareness or being perceived by others.",
      cognitivePattern: "The writing considers other people, belonging, judgment, or perspective.",
    },
    self_reflection_identity: {
      emotionalTone: "The tone turns inward toward identity and personal growth.",
      cognitivePattern: "The reflection asks what this says about the user's inner narrative.",
    },
  };

  return {
    ...detailByCenter[id],
    timeOrientation: detectTimeOrientation(userWriting),
    selfOtherFocus: detectSelfOtherFocus(userWriting, id),
    actionOrientation: getActionOrientation(id),
    ...(repeatedSignal ? { repeatedSignal } : {}),
  };
};

const buildShortInsight = (
  id: ReflectionRegionId,
  score: number,
  evidence: string[]
) => {
  const phrase = evidence[0] ? `around "${evidence[0]}"` : "lightly in the writing";

  if (score < 0.25) {
    return `${REFLECTION_REGION_DETAILS[id].productName} appeared only lightly in this period.`;
  }

  const insightByCenter: Record<ReflectionRegionId, string> = {
    emotional_intensity: `This region picked up emotional charge ${phrase}.`,
    planning_self_control:
      `This region stood out through direction, restraint, or next-step thinking ${phrase}.`,
    memory_meaning:
      `This region noticed how memory or meaning-making shaped the writing ${phrase}.`,
    body_inner_signals:
      `This region reflected body awareness, energy, rest, or internal signals ${phrase}.`,
    conflict_attention:
      `This region captured mixed feelings or unresolved tension ${phrase}.`,
    motivation_reward:
      `This region reflected momentum, progress, reward, or effort ${phrase}.`,
    relationships_perspective:
      `This region stood out through social perspective, belonging, or another person's role ${phrase}.`,
    self_reflection_identity:
      `This region reflected self-talk, values, identity, or who you may be becoming ${phrase}.`,
  };

  return insightByCenter[id];
};

export const buildReflectionRegionScore = ({
  id,
  score,
  confidence,
  rank,
  evidence,
  userWriting,
  shortInsight,
  actionStep,
  nuancedDetails,
}: {
  id: ReflectionRegionId;
  score: number;
  confidence: number;
  rank: number;
  evidence: string[];
  userWriting: string;
  shortInsight?: string | undefined;
  actionStep?: string | undefined;
  nuancedDetails?: ReflectionRegionNuancedDetails | undefined;
}): ReflectionRegionScore => {
  const safeScore = clampSignal(score, REFLECTION_REGION_DETAILS[id].lowSignalScore);
  const safeEvidence = evidence.slice(0, 3);

  return {
    id,
    productName: REFLECTION_REGION_DETAILS[id].productName,
    brainRegion: REFLECTION_REGION_DETAILS[id].brainRegion,
    score: safeScore,
    confidence: clampSignal(confidence, 0.5),
    rank,
    intensity: getReflectionRegionIntensity(safeScore),
    evidence: safeEvidence,
    shortInsight: shortInsight?.trim()
      ? normalizeReflectionMapText(shortInsight, 260)
      : buildShortInsight(id, safeScore, safeEvidence),
    actionStep: actionStep?.trim()
      ? normalizeReflectionMapText(actionStep, 260)
      : REFLECTION_REGION_FOCUS_TIPS[id],
    nuancedDetails: {
      ...buildNuancedDetails(id, userWriting, safeEvidence),
      ...(nuancedDetails || {}),
    },
  };
};

export const rankReflectionRegionScores = (regions: ReflectionRegionScore[]) => {
  const sorted = [...regions].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return REFLECTION_REGION_IDS.indexOf(left.id) - REFLECTION_REGION_IDS.indexOf(right.id);
  });

  if (sorted[0] && sorted[1] && sorted[0].score <= sorted[1].score) {
    sorted[0] = {
      ...sorted[0],
      score: clampSignal(sorted[1].score + 0.03, sorted[0].score),
    };
  }

  return sorted.map((region, index) => ({
    ...region,
    rank: index + 1,
    intensity: getReflectionRegionIntensity(region.score),
  }));
};

export const getReflectionRegionKeywordScore = (
  id: ReflectionRegionId,
  text: string
) => {
  const comparable = getReflectionEvidenceComparableText(text);

  return REFLECTION_REGION_SIGNAL_RULES[id].reduce((total, rule) => {
    const matched = rule.terms.some(term =>
      comparable.includes(getReflectionEvidenceComparableText(term))
    );

    return matched ? total + rule.weight : total;
  }, 0);
};

// --- Neutral emphasis trends -------------------------------------------------
// Trends describe how much a theme is *showing up* in recent writing versus
// earlier writing. They carry no good/bad valence — the app stays non-clinical
// and never frames a region as improving or declining.

export const getReflectionRegionTrend = (
  recentMean: number,
  earlierMean: number,
  threshold = 0.08
): ReflectionRegionTrend => {
  const delta = recentMean - earlierMean;

  if (delta >= threshold) {
    return "rising";
  }

  if (delta <= -threshold) {
    return "easing";
  }

  return "steady";
};

export const getReflectionRegionTrendLabel = (
  id: ReflectionRegionId,
  trend: ReflectionRegionTrend
) => {
  const name = REFLECTION_REGION_DETAILS[id].productName;

  if (trend === "rising") {
    return `${name} has been showing up more in your recent writing.`;
  }

  if (trend === "easing") {
    return `${name} has been showing up less in your recent writing.`;
  }

  return `${name} has stayed steady in your recent writing.`;
};

// --- Reflection tier scoring -------------------------------------------------
// A deterministic read of how strongly each region shows up in a person's
// writing compared with a typical reflector. Bands only — never a number,
// percentile, or clinical judgement. The thresholds are calibration constants
// (the "typical reflector" reference) and are expected to be tuned once real
// aggregate data is eyeballed.

export const REFLECTION_REGION_BASELINE: Record<
  ReflectionRegionId,
  { balanced: number; high: number; veryHigh: number }
> = {
  emotional_intensity: { balanced: 0.28, high: 0.46, veryHigh: 0.64 },
  planning_self_control: { balanced: 0.38, high: 0.55, veryHigh: 0.72 },
  memory_meaning: { balanced: 0.33, high: 0.5, veryHigh: 0.68 },
  body_inner_signals: { balanced: 0.24, high: 0.4, veryHigh: 0.58 },
  conflict_attention: { balanced: 0.26, high: 0.44, veryHigh: 0.62 },
  motivation_reward: { balanced: 0.26, high: 0.44, veryHigh: 0.62 },
  relationships_perspective: { balanced: 0.3, high: 0.48, veryHigh: 0.66 },
  self_reflection_identity: { balanced: 0.45, high: 0.62, veryHigh: 0.78 },
};

const REFLECTION_REGION_TIER_LABELS: Record<ReflectionRegionTier, string> = {
  low: "Low",
  balanced: "Balanced",
  high: "High",
  very_high: "Very High",
};

const REFLECTION_TIER_RANK: Record<ReflectionRegionTier, number> = {
  low: 0,
  balanced: 1,
  high: 2,
  very_high: 3,
};

// Band a region's absolute engagement (its pre-normalization weighted mean for
// aggregates, or a single entry's region score) against the baseline table.
export const getReflectionRegionTier = (
  id: ReflectionRegionId,
  meanSignal: number
): ReflectionRegionTier => {
  const baseline = REFLECTION_REGION_BASELINE[id];
  const value = Number.isFinite(meanSignal) ? meanSignal : 0;

  if (value >= baseline.veryHigh) {
    return "very_high";
  }
  if (value >= baseline.high) {
    return "high";
  }
  if (value >= baseline.balanced) {
    return "balanced";
  }
  return "low";
};

export const getReflectionRegionTierLabel = (tier: ReflectionRegionTier) =>
  REFLECTION_REGION_TIER_LABELS[tier];

// Overall reflective style from the breadth (how many regions are engaged) and
// depth (how many show up strongly) of the region tiers. Comparative in tone
// ("more than most journalers") but never numeric or diagnostic.
export const getOverallReflectionTier = (
  regionTiers: ReflectionRegionTier[]
): OverallReflectionTier => {
  const engagedCount = regionTiers.filter(
    tier => REFLECTION_TIER_RANK[tier] >= REFLECTION_TIER_RANK.balanced
  ).length;
  const strongCount = regionTiers.filter(
    tier => REFLECTION_TIER_RANK[tier] >= REFLECTION_TIER_RANK.high
  ).length;

  if (engagedCount >= 6 && strongCount >= 3) {
    return {
      tier: "highly_attuned",
      label: "Highly Attuned",
      blurb:
        "You reflect both broadly and deeply — a wide-ranging, self-aware style few journalers reach.",
    };
  }

  if (strongCount >= 2 || engagedCount >= 5) {
    return {
      tier: "deeply_reflective",
      label: "Deeply Reflective",
      blurb:
        "You go deeper than most journalers in a few areas, returning to them with real consistency.",
    };
  }

  if (engagedCount >= 3) {
    return {
      tier: "balanced",
      label: "Balanced Reflector",
      blurb:
        "You reflect fairly evenly across several areas — a well-rounded reflective style.",
    };
  }

  return {
    tier: "emerging",
    label: "Emerging Reflector",
    blurb:
      "Your reflections are still taking shape. A few more entries will bring the fuller picture into focus.",
  };
};

// --- Supportive, non-clinical focus prompts ---------------------------------
// One gentle reflection prompt per region. Never advice, never diagnostic —
// just an invitation to notice, framed around the user's own writing.

export const REFLECTION_REGION_FOCUS_TIPS: Record<ReflectionRegionId, string> = {
  emotional_intensity:
    "When strong feelings show up, it can help to name them on the page before deciding what they mean.",
  planning_self_control:
    "You often write toward what's next. Noticing one small, kind next step can make the plan feel lighter.",
  memory_meaning:
    "Your writing connects the present to the past. It can be worth asking what a memory is trying to remind you of.",
  body_inner_signals:
    "Your entries notice the body — energy, rest, tension. Checking in with those signals can add useful context.",
  conflict_attention:
    "Mixed or competing feelings show up here. Writing both sides out, without resolving them yet, can ease the tension.",
  motivation_reward:
    "You track effort and momentum. Naming what actually felt worth it can help you notice your own progress.",
  relationships_perspective:
    "Other people appear often in your reflections. It can help to separate what you felt from what you imagined they thought.",
  self_reflection_identity:
    "You return to who you're becoming. Gentle, honest self-talk on the page tends to matter more than getting it right.",
};

// --- AI per-entry region scoring schema -------------------------------------
// Paired Zod + JSON Schema for the OpenAI Responses API structured output.
// The model returns a raw 0-1 signal per region; deterministic post-processing
// (ranking, evidence sanitising, intensity) happens in the scorer service.

export const reflectionRegionIdSchema = z.enum([
  "emotional_intensity",
  "planning_self_control",
  "memory_meaning",
  "body_inner_signals",
  "conflict_attention",
  "motivation_reward",
  "relationships_perspective",
  "self_reflection_identity",
]);

const ENTRY_REGION_EVIDENCE_MAX_LENGTH = 60;
// Same ceiling as the aggregate map's `noticed`, and for the same reason: the
// string lands in `shortInsight`, which buildReflectionRegionScore caps at 260.
// Empty is allowed here — a region that barely showed up in one entry should
// fall back to the deterministic sentence rather than invent a pattern.
const ENTRY_REGION_NOTICED_MAX_LENGTH = 260;

export const entryRegionAiScoreSchema = z.object({
  id: reflectionRegionIdSchema,
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  /** Overrides the generic `buildShortInsight` template for this entry. */
  noticed: z.string().trim().max(ENTRY_REGION_NOTICED_MAX_LENGTH),
  evidence: z
    .array(z.string().trim().min(1).max(ENTRY_REGION_EVIDENCE_MAX_LENGTH))
    .max(3),
});

export const entryRegionScoresSchema = z.object({
  regions: z.array(entryRegionAiScoreSchema).length(8),
  dominantRegionId: reflectionRegionIdSchema,
});

export type EntryRegionAiScores = z.infer<typeof entryRegionScoresSchema>;

const entryRegionAiScoreJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", enum: REFLECTION_REGION_IDS },
    score: { type: "number", minimum: 0, maximum: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    noticed: { type: "string", maxLength: ENTRY_REGION_NOTICED_MAX_LENGTH },
    evidence: {
      type: "array",
      maxItems: 3,
      items: {
        type: "string",
        minLength: 1,
        maxLength: ENTRY_REGION_EVIDENCE_MAX_LENGTH,
      },
    },
  },
  required: ["id", "score", "confidence", "noticed", "evidence"],
};

export const entryRegionScoresJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    regions: {
      type: "array",
      minItems: 8,
      maxItems: 8,
      items: entryRegionAiScoreJsonSchema,
    },
    dominantRegionId: { type: "string", enum: REFLECTION_REGION_IDS },
  },
  required: ["regions", "dominantRegionId"],
} satisfies Record<string, unknown>;

// --- Mind Map action steps schema -------------------------------------------
// One structured call turns the user's own writing into a single practical,
// supportive next step per region. Steps stay non-clinical and uncertainty-aware
// (a suggestion to try, never a directive or diagnosis). Deterministic fallback
// is REFLECTION_REGION_FOCUS_TIPS when the model returns null or omits a region.

const MIND_MAP_ACTION_STEP_MAX_LENGTH = 220;

/**
 * Matches the cap `buildReflectionRegionScore` applies to `shortInsight`, and
 * that cap is deliberately unchanged: the string renders both in the region
 * sheet and in the unclamped selected-region card on the Mind Map screen, so
 * the ceiling is a layout constraint, not just a prompt hint.
 */
const MIND_MAP_NOTICED_MAX_LENGTH = 260;

export const mindMapActionStepAiSchema = z.object({
  regionId: reflectionRegionIdSchema,
  /** Replaces the generic `buildShortInsight` template when the AI path runs. */
  noticed: z.string().trim().min(1).max(MIND_MAP_NOTICED_MAX_LENGTH),
  actionStep: z.string().trim().min(1).max(MIND_MAP_ACTION_STEP_MAX_LENGTH),
});

export const mindMapActionStepsSchema = z.object({
  steps: z.array(mindMapActionStepAiSchema).min(1).max(8),
});

export type MindMapActionSteps = z.infer<typeof mindMapActionStepsSchema>;

export const mindMapActionStepsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    steps: {
      type: "array",
      minItems: 8,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          regionId: { type: "string", enum: REFLECTION_REGION_IDS },
          noticed: {
            type: "string",
            minLength: 1,
            maxLength: MIND_MAP_NOTICED_MAX_LENGTH,
          },
          actionStep: {
            type: "string",
            minLength: 1,
            maxLength: MIND_MAP_ACTION_STEP_MAX_LENGTH,
          },
        },
        required: ["regionId", "noticed", "actionStep"],
      },
    },
  },
  required: ["steps"],
} satisfies Record<string, unknown>;

// --- Per-entry insight extraction (regions + therapist-style themes) ---------
// One structured call produces both the 8-region signal AND the persisted
// "key insight" for cross-session memory and the Mind Map's recurring patterns.
// A theme is a recurring behavioural/emotional dynamic a thoughtful therapist
// would notice — named directly, never as a clinical diagnosis or condition.

export type EntryInsightTheme = {
  label: string;
  rationale: string;
  evidenceQuote: string;
  confidence: number;
};

const ENTRY_THEME_LABEL_MAX = 64;
const ENTRY_THEME_RATIONALE_MAX = 220;
const ENTRY_THEME_EVIDENCE_MAX = 180;
const ENTRY_CONTEXT_SUMMARY_MAX = 400;
const ENTRY_EMOTIONAL_TONE_MAX = 80;

export const entryInsightThemeAiSchema = z.object({
  label: z.string().trim().min(1).max(ENTRY_THEME_LABEL_MAX),
  rationale: z.string().trim().min(1).max(ENTRY_THEME_RATIONALE_MAX),
  evidenceQuote: z.string().trim().min(1).max(ENTRY_THEME_EVIDENCE_MAX),
  confidence: z.number().min(0).max(1),
});

export const entryInsightExtractionSchema = z.object({
  regions: z.array(entryRegionAiScoreSchema).length(8),
  dominantRegionId: reflectionRegionIdSchema,
  contextSummary: z.string().trim().min(1).max(ENTRY_CONTEXT_SUMMARY_MAX),
  emotionalTone: z.string().trim().min(1).max(ENTRY_EMOTIONAL_TONE_MAX),
  themes: z.array(entryInsightThemeAiSchema).max(4),
});

export type EntryInsightExtraction = z.infer<typeof entryInsightExtractionSchema>;

const entryInsightThemeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: "string", minLength: 1, maxLength: ENTRY_THEME_LABEL_MAX },
    rationale: {
      type: "string",
      minLength: 1,
      maxLength: ENTRY_THEME_RATIONALE_MAX,
    },
    evidenceQuote: {
      type: "string",
      minLength: 1,
      maxLength: ENTRY_THEME_EVIDENCE_MAX,
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["label", "rationale", "evidenceQuote", "confidence"],
};

export const entryInsightExtractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    regions: {
      type: "array",
      minItems: 8,
      maxItems: 8,
      items: entryRegionAiScoreJsonSchema,
    },
    dominantRegionId: { type: "string", enum: REFLECTION_REGION_IDS },
    contextSummary: {
      type: "string",
      minLength: 1,
      maxLength: ENTRY_CONTEXT_SUMMARY_MAX,
    },
    emotionalTone: {
      type: "string",
      minLength: 1,
      maxLength: ENTRY_EMOTIONAL_TONE_MAX,
    },
    themes: {
      type: "array",
      maxItems: 4,
      items: entryInsightThemeJsonSchema,
    },
  },
  required: [
    "regions",
    "dominantRegionId",
    "contextSummary",
    "emotionalTone",
    "themes",
  ],
} satisfies Record<string, unknown>;

/**
 * Deterministic themes derived from the ranked regions when AI is unavailable.
 * Approximates therapist-observed themes using the strongest regions that have
 * concrete evidence in the user's own words. Always safe / non-diagnostic.
 */
export const buildHeuristicEntryThemes = (
  ranked: ReflectionRegionScore[]
): EntryInsightTheme[] =>
  ranked
    .filter(region => region.score >= 0.34 && region.evidence.length > 0)
    .slice(0, 3)
    .map(region => ({
      label: region.productName,
      rationale: region.shortInsight,
      evidenceQuote: region.evidence[0] ?? "",
      confidence: region.confidence,
    }))
    .filter(theme => theme.evidenceQuote.trim().length > 0);

/** Deterministic fallback context recap for cross-session memory. */
export const buildHeuristicEntryContextSummary = (
  ranked: ReflectionRegionScore[]
): string => {
  const strongest = ranked[0];
  if (!strongest) {
    return "A brief reflection was recorded.";
  }
  return `This entry leaned most into ${strongest.productName.toLowerCase()} patterns${
    strongest.evidence[0] ? `, around "${strongest.evidence[0]}"` : ""
  }.`;
};

export const buildHeuristicEntryEmotionalTone = (
  ranked: ReflectionRegionScore[]
): string =>
  ranked[0]?.nuancedDetails.emotionalTone?.trim() ||
  "A reflective, even tone.";
