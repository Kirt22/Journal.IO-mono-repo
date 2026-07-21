export type ReflectionRegionId =
  | "emotional_intensity"
  | "planning_self_control"
  | "memory_meaning"
  | "body_inner_signals"
  | "conflict_attention"
  | "motivation_reward"
  | "relationships_perspective"
  | "self_reflection_identity";

export type ReflectionRegionIntensity = "low" | "moderate" | "high";

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
  nuancedDetails,
}: {
  id: ReflectionRegionId;
  score: number;
  confidence: number;
  rank: number;
  evidence: string[];
  userWriting: string;
  shortInsight?: string | undefined;
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
