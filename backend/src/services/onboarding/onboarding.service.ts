type OnboardingDemoMood = "great" | "good" | "okay" | "low" | "stressed";

type OnboardingDemoAnalysisInput = {
  mood: OnboardingDemoMood;
  feeling?: string;
  challenge?: string;
  thoughts: string;
};

type OnboardingDemoKeyword = {
  label: string;
  description: string;
};

type OnboardingDemoAnalysisResponse = {
  moodTone: string;
  summary: string;
  keywords: OnboardingDemoKeyword[];
  prompt: string;
};

const moodLabels: Record<OnboardingDemoMood, string> = {
  great: "Great",
  good: "Good",
  okay: "Okay",
  low: "Low",
  stressed: "Stressed",
};

const moodTones: Record<OnboardingDemoMood, string> = {
  great: "energized and uplifted",
  good: "calm and steady",
  okay: "neutral and reflective",
  low: "tender and introspective",
  stressed: "overwhelmed but searching",
};

const keywordStopWords = new Set([
  "about",
  "after",
  "again",
  "already",
  "because",
  "being",
  "down",
  "felt",
  "from",
  "have",
  "into",
  "just",
  "like",
  "more",
  "that",
  "the",
  "this",
  "through",
  "today",
  "with",
  "your",
]);

const cleanText = (value?: string) => (value || "").trim().replace(/\s+/g, " ");

const extractKeywordCandidates = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map(candidate => candidate.trim())
    .filter(candidate => candidate.length > 3 && !keywordStopWords.has(candidate));

const toDisplayKeyword = (value?: string) => {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return "";
  }

  return cleaned.length > 42 ? `${cleaned.slice(0, 39).trim()}...` : cleaned;
};

const formatQuotedList = (values: string[]) => {
  const quotedValues = values.map(value => `"${value}"`);

  if (quotedValues.length <= 1) {
    return quotedValues[0] || "";
  }

  if (quotedValues.length === 2) {
    return `${quotedValues[0]} and ${quotedValues[1]}`;
  }

  return `${quotedValues.slice(0, -1).join(", ")}, and ${quotedValues[quotedValues.length - 1]}`;
};

const addKeyword = (
  keywords: OnboardingDemoKeyword[],
  seenKeywords: Set<string>,
  keyword: OnboardingDemoKeyword
) => {
  const normalizedLabel = keyword.label.toLowerCase();

  if (!keyword.label || seenKeywords.has(normalizedLabel)) {
    return;
  }

  seenKeywords.add(normalizedLabel);
  keywords.push(keyword);
};

const buildOnboardingDemoKeywords = (
  input: OnboardingDemoAnalysisInput
): OnboardingDemoKeyword[] => {
  const feeling = toDisplayKeyword(input.feeling);
  const challenge = toDisplayKeyword(input.challenge);
  const moodLabel = moodLabels[input.mood];
  const keywords: OnboardingDemoKeyword[] = [];
  const seenKeywords = new Set<string>();

  addKeyword(keywords, seenKeywords, {
    label: moodLabel,
    description: `Your ${moodLabel.toLowerCase()} mood check-in gives this demo reflection its emotional starting point.`,
  });

  if (feeling) {
    addKeyword(keywords, seenKeywords, {
      label: feeling,
      description: `You named "${feeling}" as the feeling word, so the reflection keeps that emotion visible without judging it.`,
    });
  }

  if (challenge) {
    addKeyword(keywords, seenKeywords, {
      label: challenge,
      description: `"${challenge}" appears to be the main gentle hurdle you wanted the reflection to notice.`,
    });
  }

  for (const candidate of extractKeywordCandidates(input.thoughts)) {
    if (keywords.length >= 6) {
      break;
    }

    addKeyword(keywords, seenKeywords, {
      label: candidate,
      description: `"${candidate}" appeared in your entry, so the reflection uses it as part of the day's context.`,
    });
  }

  return keywords;
};

const buildOnboardingDemoAnalysis = (
  rawInput: OnboardingDemoAnalysisInput
): OnboardingDemoAnalysisResponse => {
  const input = {
    mood: rawInput.mood,
    feeling: cleanText(rawInput.feeling),
    challenge: cleanText(rawInput.challenge),
    thoughts: cleanText(rawInput.thoughts),
  };
  const keywords = buildOnboardingDemoKeywords(input);
  const keywordLabels = keywords.map(keyword => keyword.label);
  const moodTone = moodTones[input.mood];
  const keywordAnchorSentence =
    keywordLabels.length > 0
      ? ` I noticed ${formatQuotedList(keywordLabels)} and used those words as anchors for this read.`
      : "";
  const feelingSentence = input.feeling
    ? `You named "${input.feeling}" as the feeling underneath the entry. `
    : "";
  const challengeSentence = input.challenge
    ? `"${input.challenge}" appears associated with the part of the day that felt heavier. `
    : "";
  const summary = `${feelingSentence}${challengeSentence}${keywordAnchorSentence} Your words suggest a moment of self-awareness: something felt present enough to name, and naming it may make the next small step feel a little more manageable.`;
  const promptFocus = keywords.find(keyword => keyword.label !== moodLabels[input.mood])?.label || moodLabels[input.mood];

  return {
    moodTone,
    summary: summary.replace(/\s+/g, " ").trim(),
    keywords,
    prompt: `What is one small, gentle thing that could make "${promptFocus}" feel a little lighter tomorrow?`,
  };
};

export { buildOnboardingDemoAnalysis };
export type {
  OnboardingDemoAnalysisInput,
  OnboardingDemoAnalysisResponse,
  OnboardingDemoKeyword,
  OnboardingDemoMood,
};
