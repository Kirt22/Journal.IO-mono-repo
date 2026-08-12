export const DETECTED_MOODS = [
  "amazing",
  "good",
  "okay",
  "bad",
  "terrible",
] as const;

export type DetectedMood = (typeof DETECTED_MOODS)[number];

export const ENTRY_TOPIC_TAXONOMY = [
  "anxiety",
  "fear",
  "stress",
  "overwhelm",
  "sadness",
  "anger",
  "frustration",
  "loneliness",
  "grief",
  "hope",
  "gratitude",
  "joy",
  "confidence",
  "calm",
  "focus",
  "consistency",
  "discipline",
  "motivation",
  "productivity",
  "routines",
  "habits",
  "self-care",
  "boundaries",
  "decision-making",
  "goals",
  "rest",
  "sleep",
  "energy",
  "work",
  "studies",
  "relationships",
  "family",
  "health",
  "fitness",
  "nutrition",
  "finances",
  "identity",
  "creativity",
] as const;

export type EntryTopic = (typeof ENTRY_TOPIC_TAXONOMY)[number];

export type EntryMetadata = {
  detectedTopics: EntryTopic[];
  detectedMood: DetectedMood;
};

const topicKeywords: Record<EntryTopic, string[]> = {
  anxiety: ["anxious", "anxiety", "nervous", "worry", "worried", "panic"],
  fear: ["afraid", "fear", "fearful", "scared", "terrified"],
  stress: ["stress", "stressed", "stressful", "pressure", "pressured"],
  overwhelm: ["overwhelm", "overwhelmed", "too much", "can't keep up"],
  sadness: ["sad", "down", "upset", "cry", "crying", "unhappy"],
  anger: ["anger", "angry", "furious", "mad", "rage"],
  frustration: ["frustrated", "frustrating", "annoyed", "irritated"],
  loneliness: ["alone", "lonely", "isolated", "left out"],
  grief: ["grief", "grieving", "loss", "miss them", "passed away"],
  hope: ["hope", "hopeful", "optimistic", "looking forward"],
  gratitude: ["grateful", "gratitude", "thankful", "appreciate"],
  joy: ["joy", "joyful", "happy", "excited", "delighted"],
  confidence: ["confident", "confidence", "capable", "proud of myself"],
  calm: ["calm", "peaceful", "grounded", "steady", "relaxed"],
  focus: ["focus", "focused", "concentrate", "attention", "distracted"],
  consistency: ["consistent", "consistency", "keep showing up", "stick with"],
  discipline: ["discipline", "disciplined", "self-control", "willpower"],
  motivation: ["motivation", "motivated", "drive", "inspired", "unmotivated"],
  productivity: ["productive", "productivity", "procrastinate", "procrastination"],
  routines: ["routine", "schedule", "morning routine", "evening routine"],
  habits: ["habit", "repeat", "repeating", "pattern"],
  "self-care": ["self-care", "take care of myself", "recharge", "burned out"],
  boundaries: ["boundary", "boundaries", "say no", "space from"],
  "decision-making": ["decision", "decide", "choice", "choose", "uncertain"],
  goals: ["goal", "plan", "aim", "achieve", "next step"],
  rest: ["rest", "break", "pause", "relax", "recovery"],
  sleep: ["sleep", "slept", "bed", "insomnia", "woke up"],
  energy: ["energy", "energized", "drained", "exhausted", "tired"],
  work: ["work", "job", "career", "meeting", "deadline", "project"],
  studies: ["study", "studies", "school", "college", "exam", "assignment"],
  relationships: ["relationship", "partner", "friend", "dating", "connection"],
  family: ["family", "mom", "mother", "dad", "father", "sibling", "parent"],
  health: ["health", "healthy", "ill", "sick", "doctor", "pain"],
  fitness: ["fitness", "exercise", "gym", "run", "workout", "walk"],
  nutrition: ["food", "meal", "diet", "eat", "eating", "nutrition"],
  finances: ["money", "financial", "finances", "budget", "debt", "rent"],
  identity: ["identity", "who i am", "myself", "becoming", "values"],
  creativity: ["creative", "creativity", "write", "draw", "art", "music"],
};

const positiveMoodTerms = [
  "amazing",
  "calm",
  "excited",
  "good",
  "grateful",
  "happy",
  "hopeful",
  "joy",
  "peaceful",
  "proud",
];
const intensePositiveMoodTerms = [
  "amazing",
  "ecstatic",
  "euphoric",
  "fantastic",
  "overjoyed",
  "thrilled",
];
const negativeMoodTerms = [
  "angry",
  "anxious",
  "bad",
  "down",
  "drained",
  "frustrated",
  "lonely",
  "sad",
  "stressed",
  "tired",
  "upset",
  "worried",
];
const intenseNegativeMoodTerms = [
  "awful",
  "devastated",
  "hopeless",
  "miserable",
  "terrible",
  "terrified",
  "unbearable",
];

const includesTerm = (text: string, term: string) => {
  const escapedTerm = term
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const termPattern = new RegExp(`\\b${escapedTerm}\\b`);
  const negatedPattern = new RegExp(
    `\\b(?:not|never|hardly|barely)\\s+(?:really\\s+)?${escapedTerm}\\b`
  );

  return termPattern.test(text) && !negatedPattern.test(text);
};

const countMatches = (text: string, terms: string[]) =>
  terms.reduce((total, term) => total + (includesTerm(text, term) ? 1 : 0), 0);

export const normalizeDetectedTopics = (
  topics: readonly string[],
  limit = 5
): EntryTopic[] => {
  const allowed = new Set<string>(ENTRY_TOPIC_TAXONOMY);

  return topics
    .map(topic => topic.trim().toLowerCase())
    .filter(
      (topic, index, allTopics): topic is EntryTopic =>
        allowed.has(topic) && allTopics.indexOf(topic) === index
    )
    .slice(0, limit);
};

export const detectEntryMetadataHeuristically = (
  content: string
): EntryMetadata => {
  const normalized = content.trim().toLowerCase();

  if (!normalized) {
    return { detectedTopics: [], detectedMood: "okay" };
  }

  const detectedTopics = (Object.entries(topicKeywords) as Array<
    [EntryTopic, string[]]
  >)
    .map(([topic, terms]) => ({
      topic,
      score: countMatches(normalized, terms),
    }))
    .filter(item => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.topic.localeCompare(right.topic);
    })
    .slice(0, 5)
    .map(item => item.topic);

  const intensePositive = countMatches(normalized, intensePositiveMoodTerms);
  const positive = countMatches(normalized, positiveMoodTerms);
  const intenseNegative = countMatches(normalized, intenseNegativeMoodTerms);
  const negative = countMatches(normalized, negativeMoodTerms);

  let detectedMood: DetectedMood = "okay";
  if (intenseNegative > 0 || negative >= positive + 3) {
    detectedMood = "terrible";
  } else if (negative > positive) {
    detectedMood = "bad";
  } else if (intensePositive > 0 || positive >= negative + 3) {
    detectedMood = "amazing";
  } else if (positive > negative) {
    detectedMood = "good";
  }

  return { detectedTopics, detectedMood };
};
