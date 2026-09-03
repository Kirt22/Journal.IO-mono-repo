const normalizeForMatch = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const editSimilarity = (left: string, right: string) => {
  if (left === right) {
    return 1;
  }
  if (!left || !right) {
    return 0;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return 1 - previous[right.length] / Math.max(left.length, right.length);
};

const tokenDiceSimilarity = (left: string, right: string) => {
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  const overlap = [...leftTokens].filter(token => rightTokens.has(token)).length;
  return (2 * overlap) / (leftTokens.size + rightTokens.size);
};

export const findNearestQuestionIndex = (
  input: string,
  questions: string[],
  threshold = 0.62,
) => {
  const normalizedInput = normalizeForMatch(input);
  let bestIndex = -1;
  let bestScore = 0;

  questions.forEach((question, index) => {
    const normalizedQuestion = normalizeForMatch(question);
    const score = Math.max(
      editSimilarity(normalizedInput, normalizedQuestion),
      tokenDiceSimilarity(normalizedInput, normalizedQuestion),
    );

    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return bestScore >= threshold ? bestIndex : -1;
};

export { normalizeForMatch };
