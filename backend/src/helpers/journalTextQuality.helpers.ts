type JournalTextQualityReason =
  | "prompt_echo"
  | "too_short"
  | "repetitive_noise"
  | "symbol_noise";

export type JournalTextQuality = {
  strippedText: string;
  analysisText: string;
  analysisWordCount: number;
  promptEchoDetected: boolean;
  lowSignalDetected: boolean;
  reasons: JournalTextQualityReason[];
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const repeatedCharacterExpression = /(.)\1{3,}/i;
const repeatedFragmentExpression = /^([a-z]{1,3})\1{2,}$/i;

const isLikelyNoiseToken = (token: string) => {
  if (token.length < 4) {
    return false;
  }

  if (
    repeatedCharacterExpression.test(token) ||
    repeatedFragmentExpression.test(token)
  ) {
    return true;
  }

  const vowelCount = (token.match(/[aeiou]/gi) || []).length;

  if (token.length >= 6 && vowelCount === 0) {
    return true;
  }

  return false;
};

const stripPromptEcho = ({
  content,
  aiPrompt,
}: {
  content: string;
  aiPrompt?: string | null | undefined;
}) => {
  const trimmedContent = content.trim();
  const trimmedPrompt = aiPrompt?.trim() || "";

  if (!trimmedPrompt) {
    return {
      strippedText: trimmedContent,
      promptEchoDetected: false,
    };
  }

  let nextText = trimmedContent;
  let promptEchoDetected = false;
  const promptPattern = new RegExp(escapeRegex(trimmedPrompt), "gi");

  if (promptPattern.test(nextText)) {
    nextText = nextText.replace(promptPattern, " ").trim();
    promptEchoDetected = true;
  } else {
    const normalizedContent = normalizeWhitespace(trimmedContent).toLowerCase();
    const normalizedPrompt = normalizeWhitespace(trimmedPrompt).toLowerCase();

    if (normalizedPrompt && normalizedContent.startsWith(normalizedPrompt)) {
      nextText = normalizedContent.slice(normalizedPrompt.length).trim();
      promptEchoDetected = true;
    }
  }

  return {
    strippedText: normalizeWhitespace(nextText),
    promptEchoDetected,
  };
};

export const analyzeJournalTextQuality = ({
  content,
  aiPrompt,
}: {
  content: string;
  aiPrompt?: string | null | undefined;
}): JournalTextQuality => {
  const { strippedText, promptEchoDetected } = stripPromptEcho({
    content,
    aiPrompt,
  });
  const rawTokens = strippedText.match(/[a-z]+(?:'[a-z]+)?/gi) || [];
  const meaningfulTokens = rawTokens.filter(token => !isLikelyNoiseToken(token));
  const analysisText = meaningfulTokens.join(" ").trim();
  const nonWhitespaceCharacters = strippedText.replace(/\s+/g, "");
  const alphabeticCharacters = (strippedText.match(/[a-z]/gi) || []).length;
  const alphaCharacterRatio = nonWhitespaceCharacters.length
    ? alphabeticCharacters / nonWhitespaceCharacters.length
    : 0;
  const reasons: JournalTextQualityReason[] = [];

  if (promptEchoDetected) {
    reasons.push("prompt_echo");
  }

  if (meaningfulTokens.length < 4) {
    reasons.push("too_short");
  }

  if (rawTokens.some(token => isLikelyNoiseToken(token))) {
    reasons.push("repetitive_noise");
  }

  if (nonWhitespaceCharacters.length >= 8 && alphaCharacterRatio < 0.45) {
    reasons.push("symbol_noise");
  }

  const lowSignalDetected =
    meaningfulTokens.length < 4 ||
    reasons.includes("repetitive_noise") ||
    reasons.includes("symbol_noise") ||
    (promptEchoDetected && meaningfulTokens.length < 6);

  return {
    strippedText,
    analysisText,
    analysisWordCount: meaningfulTokens.length,
    promptEchoDetected,
    lowSignalDetected,
    reasons,
  };
};
