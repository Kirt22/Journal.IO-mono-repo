export type JournalSafetyCategory =
  | "none"
  | "self_harm"
  | "harm_to_others";

export type JournalSafetyLevel = "none" | "support" | "urgent";

export type JournalSafetySignal = {
  category: JournalSafetyCategory;
  level: JournalSafetyLevel;
  matched: string[];
};

const selfHarmUrgentPatterns = [
  /\b(?:kill myself|end my life|take my own life|commit suicide|die by suicide)\b/i,
  /\b(?:suicidal|suicide|want to die|wanted to die|don't want to live|do not want to live)\b/i,
  /\b(?:planning to die|plan to die|can't go on|cannot go on|hurt myself)\b/i,
];

const selfHarmSupportPatterns = [
  /\b(?:self[-\s]?harm|harm myself|wish i was dead|wish i were dead)\b/i,
  /\b(?:not safe with myself|unsafe with myself|life is not worth living)\b/i,
];

const harmToOthersUrgentPatterns = [
  /\b(?:kill him|kill her|kill them|kill someone|kill people|murder someone)\b/i,
  /\b(?:want to kill|wanted to kill|going to kill|planning to kill|plan to kill)\b/i,
  /\b(?:stab him|stab her|stab them|shoot him|shoot her|shoot them)\b/i,
];

const harmToOthersSupportPatterns = [
  /\b(?:hurt someone|hurt him|hurt her|hurt them|make them pay)\b/i,
  /\b(?:murder|homicide|violent revenge)\b/i,
];

const collectMatches = (content: string, patterns: RegExp[]) =>
  patterns
    .map(pattern => content.match(pattern)?.[0]?.trim())
    .filter((match): match is string => Boolean(match));

const detectJournalSafetySignal = (content: string): JournalSafetySignal => {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return {
      category: "none",
      level: "none",
      matched: [],
    };
  }

  const harmToOthersUrgentMatches = collectMatches(
    normalizedContent,
    harmToOthersUrgentPatterns
  );

  if (harmToOthersUrgentMatches.length > 0) {
    return {
      category: "harm_to_others",
      level: "urgent",
      matched: harmToOthersUrgentMatches,
    };
  }

  const selfHarmUrgentMatches = collectMatches(normalizedContent, selfHarmUrgentPatterns);

  if (selfHarmUrgentMatches.length > 0) {
    return {
      category: "self_harm",
      level: "urgent",
      matched: selfHarmUrgentMatches,
    };
  }

  const harmToOthersSupportMatches = collectMatches(
    normalizedContent,
    harmToOthersSupportPatterns
  );

  if (harmToOthersSupportMatches.length > 0) {
    return {
      category: "harm_to_others",
      level: "support",
      matched: harmToOthersSupportMatches,
    };
  }

  const selfHarmSupportMatches = collectMatches(normalizedContent, selfHarmSupportPatterns);

  if (selfHarmSupportMatches.length > 0) {
    return {
      category: "self_harm",
      level: "support",
      matched: selfHarmSupportMatches,
    };
  }

  return {
    category: "none",
    level: "none",
    matched: [],
  };
};

const hasJournalSafetySignal = (signal: JournalSafetySignal) =>
  signal.level !== "none" && signal.category !== "none";

export { detectJournalSafetySignal, hasJournalSafetySignal };
