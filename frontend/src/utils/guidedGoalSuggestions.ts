import type { GoalSuggestion } from '../services/goalsService';
import type { FirstReflectionGoalCategory } from '../services/guidedReflectionService';

const CATEGORY_KEYWORDS: Array<{
  category: FirstReflectionGoalCategory;
  pattern: RegExp;
}> = [
  { category: 'sleep', pattern: /\b(sleep|bed|bedtime|rest|night|wake|wake-up)\b/i },
  {
    category: 'relationships',
    pattern: /\b(friend|family|partner|relationship|talk|connect)\b/i,
  },
  {
    category: 'stress',
    pattern: /\b(stress|pressure|overwhelm|calm|reset|pause|break)\b/i,
  },
  {
    category: 'confidence',
    pattern: /\b(confidence|brave|courage|believe|trust myself)\b/i,
  },
  // Body-and-fuel baselines. Placed after `stress` so a calming walk still reads
  // as stress support, but before `focus` so "Drink water first thing" is not
  // labelled Focus because of the word "start" in its description.
  {
    category: 'general',
    pattern: /\b(walk|steps|gym|workout|train|stretch|water|meal|eat|sun|daylight)\b/i,
  },
  {
    category: 'journaling_habit',
    pattern: /\b(journal|write|reflection|reflect)\b/i,
  },
  {
    category: 'self_awareness',
    pattern: /\b(notice|name|awareness|feeling|emotion)\b/i,
  },
  {
    category: 'focus',
    pattern: /\b(focus|task|plan|priority|start|finish|deadline)\b/i,
  },
  { category: 'mood', pattern: /\b(mood|joy|happy|energy|uplift)\b/i },
];

function inferGoalCategory(suggestion: GoalSuggestion) {
  const text = `${suggestion.title} ${suggestion.description}`;
  return (
    CATEGORY_KEYWORDS.find(({ pattern }) => pattern.test(text))?.category ??
    'general'
  );
}

// `frequency` and `icon` now come straight from the model (both goal-suggestion
// schemas return them), so the old regex guessing is gone. `category` is still
// inferred: only the guided-reflection endpoint returns it.
export function toGuidedGoalSuggestions(suggestions: GoalSuggestion[]) {
  return suggestions.map(suggestion => ({
    title: suggestion.title,
    description: suggestion.description,
    frequency: suggestion.frequency,
    icon: suggestion.icon,
    category: inferGoalCategory(suggestion),
  }));
}

export { inferGoalCategory };
