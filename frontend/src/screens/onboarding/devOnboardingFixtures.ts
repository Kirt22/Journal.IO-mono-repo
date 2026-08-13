import type { OnboardingV2Draft } from '../../types/onboarding';
import type { FirstReflectionStreakPayload } from './FirstGuidedReflectionScreen';

/**
 * Stand-in for everything the guided reflection would normally produce.
 *
 * The dev shortcut on the onboarding questionnaire jumps past the reflection,
 * its session analysis, and goal generation, but the screens after it still
 * read that payload — so this fabricates a complete, structurally valid one
 * rather than letting them render against holes.
 *
 * Reached only through `ENABLE_ONBOARDING_DEV_SHORTCUTS`, which is `__DEV__`.
 * Nothing here is persisted: no journal entry is created, no goals are saved,
 * and no AI endpoint is called.
 */

// Product/region names mirror REFLECTION_REGION_DETAILS in the backend's
// reflectionMap helpers, so the dev path renders the same labels as real data.
const CENTER_DETAILS = [
  {
    id: 'self_reflection_identity',
    productName: 'Self-Reflection & Identity',
    brainRegion: 'Default Mode Network',
    score: 0.82,
    shortInsight:
      'The entry keeps returning to who you are becoming rather than what happened.',
  },
  {
    id: 'planning_self_control',
    productName: 'Planning & Self-Control',
    brainRegion: 'Prefrontal Cortex',
    score: 0.71,
    shortInsight: 'There is a steady pull toward organising the next step.',
  },
  {
    id: 'emotional_intensity',
    productName: 'Emotional Intensity',
    brainRegion: 'Amygdala',
    score: 0.64,
    shortInsight: 'Feeling shows up early and then settles as you write.',
  },
  {
    id: 'memory_meaning',
    productName: 'Memory & Meaning',
    brainRegion: 'Hippocampus',
    score: 0.53,
    shortInsight: 'Older moments are being used to make sense of today.',
  },
  {
    id: 'conflict_attention',
    productName: 'Conflict & Attention',
    brainRegion: 'Anterior Cingulate Cortex',
    score: 0.47,
    shortInsight: 'Attention splits between the hurdle and the good moment.',
  },
  {
    id: 'motivation_reward',
    productName: 'Motivation & Reward',
    brainRegion: 'Reward Circuit / Ventral Striatum',
    score: 0.41,
    shortInsight: 'Small wins are being noticed and named.',
  },
  {
    id: 'relationships_perspective',
    productName: 'Relationships & Perspective',
    brainRegion: 'Social Brain / Temporoparietal Junction',
    score: 0.34,
    shortInsight: 'Other people appear mostly as context rather than focus.',
  },
  {
    id: 'body_inner_signals',
    productName: 'Body & Inner Signals',
    brainRegion: 'Insula',
    score: 0.26,
    shortInsight: 'Physical signals stay in the background of this entry.',
  },
] as const;

const buildCenters = () =>
  CENTER_DETAILS.map((center, index) => ({
    id: center.id,
    productName: center.productName,
    brainRegion: center.brainRegion,
    score: center.score,
    confidence: 0.6,
    rank: index + 1,
    intensity:
      center.score >= 0.7
        ? ('high' as const)
        : center.score >= 0.4
          ? ('moderate' as const)
          : ('low' as const),
    evidence: ['Dev fixture — no real entry text was analysed.'],
    shortInsight: center.shortInsight,
    nuancedDetails: {
      emotionalTone: 'Steady and reflective.',
      cognitivePattern: 'Notices a pattern, then asks what to do with it.',
      timeOrientation: 'mixed' as const,
      selfOtherFocus: 'self' as const,
      actionOrientation: 'reflecting' as const,
    },
  }));

const buildGoalSuggestions = () => [
  {
    id: 'dev-goal-1',
    title: 'Write one honest line each night',
    description: 'A single sentence is enough to keep the thread going.',
    frequency: 'daily' as const,
    category: 'journaling_habit' as const,
    icon: 'journal' as const,
    iconSource: 'automatic' as const,
    source: 'fallback' as const,
    selected: false,
    reminderEnabled: false,
    reminderTime: null,
  },
  {
    id: 'dev-goal-2',
    title: 'Name the hurdle before bed',
    description: 'Putting the difficult part into words makes it smaller.',
    frequency: 'daily' as const,
    category: 'stress' as const,
    icon: 'calm' as const,
    iconSource: 'automatic' as const,
    source: 'fallback' as const,
    selected: false,
    reminderEnabled: false,
    reminderTime: null,
  },
];

const buildDevFirstReflectionStreakPayload = (
  draft: OnboardingV2Draft,
): FirstReflectionStreakPayload => {
  const centers = buildCenters();
  const createdAt = Date.now();

  return {
    draft,
    journalId: undefined,
    answers: {
      good_exciting: 'Dev fixture — skipped the guided reflection.',
      hurdle: 'Dev fixture — skipped the guided reflection.',
      carry_tomorrow: 'Dev fixture — skipped the guided reflection.',
    },
    aiSummary:
      'This is a development fixture. The guided reflection was skipped, so nothing here came from a real entry.',
    threadMessages: [
      {
        id: 'dev-thread-1',
        role: 'assistant',
        kind: 'assistant_reflection',
        text: 'Dev fixture reflection — the guided reflection step was skipped.',
        createdAt,
      },
    ],
    sessionAnalysis: {
      analysis:
        'Development fixture: the reflection, its analysis, and goal generation were all skipped.',
      majorInsight: 'You tend to look for the next step before the day is done.',
      observedTrends: ['Reflecting inward', 'Planning ahead'],
      topicsObserved: ['identity', 'planning'],
      detectedTopics: ['identity', 'planning'],
      detectedMood: 'okay',
      hasEnoughSignal: true,
      brainSessionMap: {
        dominantCenterId: centers[0].id,
        dominantCenter: centers[0],
        secondaryCenterIds: [centers[1].id, centers[2].id],
        secondaryCenters: [centers[1], centers[2]],
        centers,
        neuroscienceSummary:
          'Dev fixture: self-reflection leads, with planning close behind.',
        mostNoticedText: 'Self-Reflection & Identity was most active here.',
        mindMapSeedText: 'identity, planning, steady effort',
      },
    },
    goalSuggestions: buildGoalSuggestions(),
  };
};

export { buildDevFirstReflectionStreakPayload };
