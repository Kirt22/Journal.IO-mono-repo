import HapticPressable from '../../components/HapticPressable';
import {
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  UIManager,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import {
  Text,
  TextInput,
} from '../../infrastructure/reactNative';
import { SafeAreaView } from 'react-native-safe-area-context';
import ButtonLoadingContent from '../../components/ButtonLoadingContent';
import ConfirmActionSheet from '../../components/ConfirmActionSheet';
import GoalSheet from '../../components/GoalSheet';
import GuidedFinishLoader from '../../components/GuidedFinishLoader';
import JournalWordmark from '../../components/JournalWordmark';
import KeyboardDismissAccessory from '../../components/KeyboardDismissAccessory';
import { Check, Sparkles } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  createFirstReflectionSummary,
  createGuidedReflectionDeeperResponse,
  createGuidedReflectionGoalSuggestions,
  createGuidedReflectionSessionAnalysis,
  type BrainCenterScore,
  type BrainReflectionCenterId,
  type BrainSessionMap,
  type FirstReflectionGoalCategory,
  type FirstReflectionGoalSuggestionPayload,
  type FirstReflectionPromptAnswer,
  type GuidedReflectionOnboardingContext,
  type GuidedReflectionPromptAnswer,
  type GuidedReflectionSessionAnalysisResponse,
  type GuidedReflectionThreadMessagePayload,
  type GuidedSessionTrigger,
  type GuidedSuggestionAction,
} from '../../services/guidedReflectionService';
import { createJournalEntry } from '../../services/journalService';
import type {
  GoalDraft,
  GoalIconSource,
  SavedGoal,
} from '../../services/goalsService';
import { stopHaptics, triggerHaptic } from '../../services/hapticsService';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../theme/provider';
import type { OnboardingV2Draft } from '../../types/onboarding';
import { READY_FEATURE_CARDS } from './onboardingV2.constants';

export type FirstReflectionAnalysisPayload = {
  answers: FirstReflectionAnswers;
  aiSummary: string | null;
  draft: OnboardingV2Draft;
  journalId?: string;
  sessionAnalysis: GuidedReflectionSessionAnalysisResponse;
  threadMessages: GuidedThreadMessage[];
};

export type FirstReflectionGoalsPayload = FirstReflectionAnalysisPayload & {
  goalSuggestions: FirstReflectionGoalSuggestionPayload[];
};

type FirstGuidedReflectionScreenProps = {
  draft: OnboardingV2Draft;
  onBackToReady: () => void;
  onAnalysisReady?: (payload: FirstReflectionAnalysisPayload) => void;
  onGoalsReady?: (payload: FirstReflectionGoalsPayload) => void;
  onGoalsSaved?: (goalDrafts: GoalDraft[]) => Promise<void>;
  onMindMapReady?: (payload: FirstReflectionStreakPayload) => void;
  onRemindersReady?: () => void;
  // Open-ended entries have no guided prompt answers, and the guided
  // goal-suggestion endpoint requires at least three of them. Callers outside
  // the guided flow supply their own loader (journal-id based) instead.
  loadGoalSuggestionsOverride?: () => Promise<
    FirstReflectionGoalSuggestionPayload[]
  >;
  initialAnalysisPayload?: FirstReflectionAnalysisPayload;
  initialGoalsPayload?: FirstReflectionGoalsPayload;
  initialStreakPayload?: FirstReflectionStreakPayload;
};

type FirstReflectionMode =
  | 'core_prompts'
  | 'ai_summary_loading'
  | 'optional_deeper'
  | 'deeper_loading'
  | 'session_analysis'
  | 'goals'
  | 'streak_started'
  | 'saved';

const FIRST_GUIDED_REFLECTION_KEYBOARD_ACCESSORY_ID =
  'first-guided-reflection-keyboard-actions';

const FIRST_REFLECTION_PROMPTS = [
  {
    id: 'good_exciting',
    question: 'What was one good or exciting thing that happened today?',
    helper:
      'It can be big, small, or just one moment that felt a little different.',
    required: true,
  },
  {
    id: 'hurdle',
    question: 'What was one hurdle or stressful moment you faced today?',
    helper: 'Name what felt difficult, frustrating, heavy, or unfinished.',
    required: true,
  },
  {
    id: 'carry_tomorrow',
    question: 'What would you like to carry into tomorrow?',
    helper:
      'A mindset, reminder, next step, or small promise to yourself is enough.',
    required: true,
  },
  {
    id: 'anything_else',
    question: 'What feels most important to carry forward?',
    helper: '',
    required: false,
  },
] as const;

type FirstReflectionPrompt = (typeof FIRST_REFLECTION_PROMPTS)[number];
type FirstReflectionPromptId = FirstReflectionPrompt['id'];
type FirstReflectionAnswers = Partial<Record<FirstReflectionPromptId, string>>;
type CoreReflectionPromptId = Exclude<FirstReflectionPromptId, 'anything_else'>;
type GuidedThreadMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  kind:
    | 'suggestion_request'
    | 'typed_deeper_request'
    | 'assistant_reflection'
    | 'local_error';
  text: string;
  actionType?: GuidedSuggestionAction;
  promptQuestion?: string;
  createdAt: number;
  isStreaming?: boolean;
};

type SessionAnalysis = GuidedReflectionSessionAnalysisResponse;

export type FirstReflectionGoalSuggestion =
  FirstReflectionGoalSuggestionPayload & {
    id: string;
    source?: 'ai' | 'fallback';
    selected: boolean;
    // Carried so the shared GoalSheet can edit a suggestion with the same
    // controls as a saved goal, and so those choices survive into the created
    // goal rather than being reset to defaults.
    iconSource: GoalIconSource;
    reminderEnabled: boolean;
    reminderTime: string | null;
  };

export type FirstReflectionStreakPayload = FirstReflectionAnalysisPayload & {
  goalSuggestions: FirstReflectionGoalSuggestion[];
};

const TENDER_SUPPORT_FOCUS = new Set([
  'anger',
  'loneliness',
  'low_mood',
  'overthinking',
  'stress',
]);

const SUGGESTION_OPTIONS: Array<{
  actionType: GuidedSuggestionAction;
  label: string;
  requestText: string;
}> = [
  {
    actionType: 'gentle_prompt',
    label: 'Give me a gentle prompt',
    requestText: 'Give me a gentle prompt.',
  },
  {
    actionType: 'go_deeper',
    label: 'Help me go deeper',
    requestText: 'Help me go deeper.',
  },
  {
    actionType: 'another_perspective',
    label: 'Offer another perspective',
    requestText: 'Offer another perspective.',
  },
  {
    actionType: 'small_next_step',
    label: 'Suggest a small next step',
    requestText: 'Suggest a small next step.',
  },
  {
    actionType: 'summarize',
    label: 'Summarize what I wrote',
    requestText: 'Summarize what I wrote.',
  },
];

const CORE_PROMPT_COUNT = 3;
// Upper bound on adaptive follow-up turns. The backend's canGoDeeper decides
// when a session has naturally resolved; this is just a safety ceiling so a
// The guided thread can run several turns before wrapping up.
const MAX_DEEPER_REFLECTIONS = 6;
const REFLECTION_ACTION_ROW_HEIGHT = 82;
const CORE_TO_TRANSCRIPT_EXIT_MS = 180;
const TRANSCRIPT_ENTRANCE_MS = 280;
const SUGGESTION_REQUEST_REVEAL_MS = 220;
const SESSION_TAG_FALLBACKS = ['Reflection', 'Tomorrow', 'Habits'];
const BRAIN_CENTER_FALLBACKS: Array<{
  id: BrainReflectionCenterId;
  productName: string;
  brainRegion: string;
  score: number;
}> = [
  {
    id: 'self_reflection_identity',
    productName: 'Self-Reflection & Identity',
    brainRegion: 'Default Mode Network',
    score: 0.55,
  },
  {
    id: 'planning_self_control',
    productName: 'Planning & Self-Control',
    brainRegion: 'Prefrontal Cortex',
    score: 0.45,
  },
  {
    id: 'memory_meaning',
    productName: 'Memory & Meaning',
    brainRegion: 'Hippocampus',
    score: 0.35,
  },
  {
    id: 'relationships_perspective',
    productName: 'Relationships & Perspective',
    brainRegion: 'Social Brain / Temporoparietal Junction',
    score: 0.26,
  },
  {
    id: 'conflict_attention',
    productName: 'Conflict & Attention',
    brainRegion: 'Anterior Cingulate Cortex',
    score: 0.24,
  },
  {
    id: 'emotional_intensity',
    productName: 'Emotional Intensity',
    brainRegion: 'Amygdala',
    score: 0.22,
  },
  {
    id: 'motivation_reward',
    productName: 'Motivation & Reward',
    brainRegion: 'Reward Circuit / Ventral Striatum',
    score: 0.2,
  },
  {
    id: 'body_inner_signals',
    productName: 'Body & Inner Signals',
    brainRegion: 'Insula',
    score: 0.18,
  },
];
const TYPEWRITER_CHUNK_MS = 28;
const SESSION_ANALYSIS_CARD_REVEAL_MS = 300;
const SESSION_ANALYSIS_CARD_GAP_MS = 240;
const SESSION_ANALYSIS_CARD_COUNT = 3;
const GOAL_CARD_REVEAL_MS = 300;
const GOAL_CARD_GAP_MS = 160;

type TypewriterTextProps = {
  active: boolean;
  onComplete?: () => void;
  style?: StyleProp<TextStyle>;
  text: string;
};

const TypewriterText = ({
  active,
  onComplete,
  style,
  text,
}: TypewriterTextProps) => {
  const [visibleText, setVisibleText] = useState('');
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const chunks = text.match(/\S+\s*/g) || [text];
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const revealNextChunk = () => {
      index += 1;
      setVisibleText(chunks.slice(0, index).join(''));

      if (index < chunks.length) {
        timer = setTimeout(revealNextChunk, TYPEWRITER_CHUNK_MS);
        return;
      }

      onCompleteRef.current?.();
    };

    timer = setTimeout(revealNextChunk, 120);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [active, text]);

  return <Text style={style}>{visibleText}</Text>;
};

const READY_CARD_INITIAL_DELAY_MS = 620;
const READY_CARD_STAGGER_MS = 430;
const READY_CARD_DURATION_MS = 760;
const GOAL_CATEGORY_LABELS: Record<FirstReflectionGoalCategory, string> = {
  confidence: 'Confidence',
  focus: 'Focus',
  general: 'General',
  journaling_habit: 'Journaling habit',
  mood: 'Mood',
  relationships: 'Relationships',
  self_awareness: 'Self-awareness',
  sleep: 'Sleep',
  stress: 'Stress',
};
const GOAL_FREQUENCY_LABELS: Record<
  FirstReflectionGoalSuggestion['frequency'],
  string
> = {
  as_needed: 'As needed',
  daily: 'Daily',
  weekly: 'Weekly',
};
const STREAK_CONFETTI = [
  { rotation: '-124deg', x: -78, y: -74 },
  { rotation: '88deg', x: -46, y: -118 },
  { rotation: '-82deg', x: -18, y: -92 },
  { rotation: '122deg', x: 20, y: -122 },
  { rotation: '-104deg', x: 62, y: -82 },
  { rotation: '98deg', x: 88, y: -46 },
  { rotation: '-96deg', x: -96, y: -38 },
  { rotation: '116deg', x: 42, y: -142 },
] as const;
const FALLBACK_GOAL_SUGGESTIONS: FirstReflectionGoalSuggestionPayload[] = [
  {
    title: 'Write for 5 minutes',
    description:
      'Take five quiet minutes to write what felt most noticeable today.',
    frequency: 'daily',
    category: 'journaling_habit',
    icon: 'journal',
  },
  {
    title: 'Notice one pattern',
    description:
      'At the end of the day, name one thought, mood, or habit that repeated.',
    frequency: 'daily',
    category: 'self_awareness',
    icon: 'mood',
  },
  {
    title: 'Carry one small step',
    description: 'Choose one small action you want to bring into tomorrow.',
    frequency: 'as_needed',
    category: 'general',
    icon: 'target',
  },
];
const STREAK_FLAME_ANIMATION_DURATION_MS = 510;

const readyCelebrationIcon = require('../../assets/png/onboarding/ready-congratulations.png');
const readyFeatureIcons = [
  require('../../assets/png/onboarding/ready-question.png'),
  require('../../assets/png/onboarding/ready-privacy.png'),
  require('../../assets/png/onboarding/ready-growth.png'),
] satisfies ImageSourcePropType[];
const onboardingStreakFireIcon = require('../../assets/png/streaks/streak-fire.png');

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const formatTopicLabel = (topic: string) =>
  topic
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const isMeaningfulAnswer = (value?: string) =>
  Boolean(value && value.trim().replace(/\s+/g, ' ').length >= 2);

const getTone = (draft: OnboardingV2Draft) =>
  draft.reflectionTone?.[0] || 'neutral';

const hasTenderSupportFocus = (draft: OnboardingV2Draft) =>
  Boolean(
    draft.supportFocusAreas?.some(item => TENDER_SUPPORT_FOCUS.has(item)),
  );

const getContextHint = (draft: OnboardingV2Draft) => {
  switch (draft.primaryContext) {
    case 'student':
      return 'You can include studies, deadlines, routines, or anything outside them.';
    case 'working_professional':
      return 'Work, meetings, responsibilities, or what follows you home can all belong here.';
    case 'founder_builder':
      return 'Building, uncertainty, pressure, and momentum are all fair to name.';
    case 'creative_work':
      return 'Ideas, creative blocks, energy, or the shape of the day can all be part of it.';
    case 'looking_for_work':
      return 'Transition, confidence, applications, and the in-between moments can all fit.';
    default:
      return 'Keep it simple. Start with what feels true right now.';
  }
};

const getToneAdjustedHelperText = (
  prompt: FirstReflectionPrompt,
  draft: OnboardingV2Draft,
) => {
  const tone = getTone(draft);
  const tender = hasTenderSupportFocus(draft);

  if (tender && prompt.id === 'hurdle') {
    return 'Name it gently. A few honest words are enough, especially if this part of today felt heavy.';
  }

  if (prompt.id === 'good_exciting') {
    const contextHint = getContextHint(draft);

    if (tone === 'direct') {
      return 'Name one good moment from today. Small counts.';
    }

    if (tone === 'deep') {
      return `Start with the moment that still has a little charge. ${contextHint}`;
    }

    if (tone === 'motivating') {
      return 'Start with one small win or spark. A clear sentence counts.';
    }

    return `${prompt.helper} ${contextHint}`;
  }

  if (tone === 'direct') {
    return prompt.id === 'hurdle'
      ? 'Name the hardest part plainly.'
      : prompt.id === 'carry_tomorrow'
      ? 'Choose one thing to bring forward.'
      : 'Optional. Add only what matters.';
  }

  if (tone === 'practical') {
    return prompt.id === 'carry_tomorrow'
      ? 'A small next step or reminder is enough.'
      : prompt.helper;
  }

  if (tone === 'deep') {
    return prompt.id === 'hurdle'
      ? 'Look for the quieter layer underneath the difficult part of the day.'
      : prompt.helper;
  }

  if (tone === 'gentle' || tender) {
    return `${prompt.helper} There is no need to force a perfect answer.`;
  }

  return prompt.helper;
};

/**
 * Section labels this composer writes into the entry. Reported to the backend
 * so it can tell them apart from what the person typed.
 */
const GUIDED_ENTRY_LABELS = [
  'One good or exciting thing from today:',
  'One hurdle or stressful moment:',
  'What I want to carry into tomorrow:',
  'Journal.IO reflection:',
  'Going deeper:',
  'Question:',
  'My response:',
  'Journal.IO:',
  'I added:',
];

/**
 * Build the saved entry, and record exactly which strings Journal.IO
 * contributed to it.
 *
 * The entry is one prose blob with app and user text interleaved, so without
 * this manifest the backend cannot tell them apart: Jade's own reflection gets
 * quoted back as the person's evidence, and the questions the app asked read as
 * topics they raised. `appAuthoredSegments` is what keeps that boundary honest.
 */
const composeFirstReflectionEntry = ({
  answers,
  aiSummary,
  threadMessages,
}: {
  answers: FirstReflectionAnswers;
  aiSummary: string | null;
  threadMessages: GuidedThreadMessage[];
}): { content: string; appAuthoredSegments: string[] } => {
  const parts: string[] = [];
  const appAuthored: string[] = [...GUIDED_ENTRY_LABELS];
  const good = answers.good_exciting?.trim();
  const hurdle = answers.hurdle?.trim();
  const carry = answers.carry_tomorrow?.trim();
  const extra = answers.anything_else?.trim();

  if (good) {
    parts.push(`One good or exciting thing from today:\n${good}`);
  }

  if (hurdle) {
    parts.push(`One hurdle or stressful moment:\n${hurdle}`);
  }

  if (carry) {
    parts.push(`What I want to carry into tomorrow:\n${carry}`);
  }

  if (aiSummary) {
    parts.push(`Journal.IO reflection:\n${aiSummary.trim()}`);
    appAuthored.push(aiSummary.trim());
  }

  const deeperLines = threadMessages
    .filter(item => item.kind !== 'local_error' && item.text.trim())
    .map(item => {
      const text = item.text.trim();

      if (item.role === 'user') {
        if (item.promptQuestion) {
          // The question was written by the app; only the response below it
          // belongs to the person.
          appAuthored.push(item.promptQuestion.trim());
          return `Question:\n${item.promptQuestion}\nMy response:\n${text}`;
        }
        return `My response:\n${text}`;
      }

      if (item.role === 'assistant') {
        appAuthored.push(text);
        return `Journal.IO:\n${text}`;
      }

      return text;
    });

  if (extra) {
    deeperLines.push(`I added:\n${extra}`);
  }

  if (deeperLines.length) {
    parts.push(`Going deeper:\n${deeperLines.join('\n\n')}`);
  }

  return {
    content: parts.join('\n\n'),
    appAuthoredSegments: Array.from(new Set(appAuthored.filter(Boolean))),
  };
};

const getGeneratedTitle = () => "Today's reflection";

const uniq = <T,>(items: T[]) => Array.from(new Set(items));

const toGoalId = (value: string, index: number) =>
  `${
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'goal'
  }-${index}`;

const createGoalSuggestionsFromPayload = (
  goals: FirstReflectionGoalSuggestionPayload[],
  source: 'ai' | 'fallback',
): FirstReflectionGoalSuggestion[] =>
  goals.slice(0, 4).map((goal, index) => ({
    ...goal,
    id: toGoalId(goal.title, index),
    selected: false,
    source,
    iconSource: 'automatic' as const,
    reminderEnabled: false,
    reminderTime: null,
  }));

const getSafeSessionTags = ({
  answers,
  draft,
  aiSummary,
}: {
  answers: FirstReflectionAnswers;
  draft: OnboardingV2Draft;
  aiSummary: string | null;
}) => {
  const source = [
    answers.good_exciting,
    answers.hurdle,
    answers.carry_tomorrow,
    answers.anything_else,
    aiSummary,
    draft.primarySupportFocus,
    ...(draft.supportFocusAreas || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const candidates: string[] = [];
  const addWhen = (patterns: string[], tag: string) => {
    if (patterns.some(pattern => source.includes(pattern))) {
      candidates.push(tag);
    }
  };

  addWhen(
    ['discipline', 'diet', 'habit', 'routine', 'consistent'],
    'Discipline',
  );
  addWhen(['stress', 'pressure', 'hurdle', 'hard', 'difficult'], 'Stress');
  addWhen(['family', 'dad', 'mom', 'parent', 'brother', 'sister'], 'Family');
  addWhen(['work', 'meeting', 'job', 'office'], 'Work');
  addWhen(['study', 'student', 'exam', 'class'], 'Study');
  addWhen(['sleep', 'tired', 'rest'], 'Sleep');
  addWhen(['energy', 'drained', 'battery'], 'Energy');
  addWhen(['confidence', 'judged', 'self-image', 'body'], 'Confidence');
  addWhen(['tomorrow', 'carry', 'next'], 'Tomorrow');

  return uniq([...candidates, ...SESSION_TAG_FALLBACKS]).slice(0, 6);
};

const getBrainCenterIntensity = (
  score: number,
): BrainCenterScore['intensity'] => {
  if (score >= 0.67) {
    return 'high';
  }

  if (score >= 0.34) {
    return 'moderate';
  }

  return 'low';
};

const getFallbackEvidence = (answers: FirstReflectionAnswers) =>
  [
    answers.good_exciting,
    answers.hurdle,
    answers.carry_tomorrow,
    answers.anything_else,
  ]
    .map(item => item?.trim())
    .filter((item): item is string => Boolean(item))
    .map(item => item.split(/\s+/).slice(0, 6).join(' '))
    .slice(0, 3);

const buildFallbackBrainSessionMap = (
  answers: FirstReflectionAnswers,
): BrainSessionMap => {
  const fallbackEvidence = getFallbackEvidence(answers);
  const centers = BRAIN_CENTER_FALLBACKS.map(
    (center, index): BrainCenterScore => ({
      ...center,
      confidence: center.id === 'self_reflection_identity' ? 0.58 : 0.44,
      rank: index + 1,
      intensity: getBrainCenterIntensity(center.score),
      evidence:
        center.id === 'self_reflection_identity' ? fallbackEvidence : [],
      shortInsight:
        center.id === 'self_reflection_identity'
          ? 'This first signal is mostly about noticing your inner narrative and what you want to carry forward.'
          : `${center.productName} is present only lightly in this fallback reflection map.`,
      nuancedDetails: {
        actionOrientation:
          center.id === 'planning_self_control'
            ? 'planning'
            : center.id === 'motivation_reward'
            ? 'acting'
            : 'reflecting',
        selfOtherFocus:
          center.id === 'relationships_perspective' ? 'others' : 'self',
        timeOrientation:
          center.id === 'planning_self_control' ? 'future' : 'mixed',
        repeatedSignal: fallbackEvidence[0],
      },
    }),
  );
  const dominantCenter = centers[0];
  const secondaryCenters = centers.slice(1, 4);

  return {
    dominantCenterId: dominantCenter.id,
    dominantCenter,
    secondaryCenterIds: secondaryCenters.map(center => center.id),
    secondaryCenters,
    centers,
    neuroscienceSummary:
      'This reflection has started building your personal Mind Map by capturing what you noticed, what challenged you, and what you want to carry forward.',
    mostNoticedText:
      'The strongest center in this session was Self-Reflection & Identity, because this first entry begins with noticing your inner narrative.',
    mindMapSeedText:
      'Your first reflection has added its first signal to your Mind Map.',
  };
};

const createFallbackSessionAnalysis = ({
  answers,
  aiSummary,
  draft,
}: {
  answers: FirstReflectionAnswers;
  aiSummary: string | null;
  draft: OnboardingV2Draft;
}): SessionAnalysis => {
  const good = answers.good_exciting?.trim();
  const hurdle = answers.hurdle?.trim();
  const carry = answers.carry_tomorrow?.trim();
  const summaryLead = aiSummary
    ?.trim()
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(' ');

  const body =
    summaryLead ||
    [
      "Today's reflection captures a simple contrast between what felt steady and what asked for more care.",
      carry
        ? `The useful signal is what you want to carry into tomorrow: ${carry}.`
        : good && hurdle
        ? 'The useful signal is that both the good moment and the harder moment can belong in the same day.'
        : 'The useful signal is that one honest entry is already enough to begin noticing patterns.',
    ].join(' ');

  return {
    analysis: body,
    majorInsight:
      'Major insight: the strongest signal is the move from noticing pressure to choosing one grounded action for tomorrow.',
    observedTrends: getSafeSessionTags({ answers, draft, aiSummary }),
    topicsObserved: getSafeSessionTags({ answers, draft, aiSummary }),
    detectedTopics: getSafeSessionTags({ answers, draft, aiSummary })
      .map(topic => topic.toLowerCase())
      .slice(0, 5),
    detectedMood: 'okay',
    brainSessionMap: buildFallbackBrainSessionMap(answers),
    hasEnoughSignal: true,
  };
};

export default function FirstGuidedReflectionScreen({
  draft,
  onBackToReady,
  onAnalysisReady,
  onGoalsReady,
  onGoalsSaved,
  onMindMapReady,
  onRemindersReady,
  loadGoalSuggestionsOverride,
  initialAnalysisPayload,
  initialGoalsPayload,
  initialStreakPayload,
}: FirstGuidedReflectionScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const corePagerRef = useRef<ScrollView | null>(null);
  const coreInputRefs = useRef<Array<TextInput | null>>([]);
  const inputRef = useRef<TextInput | null>(null);
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const typewriterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamingFullTextRef = useRef<{ id: string; fullText: string } | null>(
    null,
  );
  const summaryTypewriterTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const summaryFullTextRef = useRef<string | null>(null);
  const sessionCardSequenceTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const coreActionsReveal = useRef(new Animated.Value(1)).current;
  const optionalActionsReveal = useRef(new Animated.Value(1)).current;
  const coreToTranscriptExit = useRef(new Animated.Value(1)).current;
  const transcriptEntrance = useRef(new Animated.Value(1)).current;
  const suggestionRequestReveal = useRef(new Animated.Value(1)).current;
  const suggestionSheetSlide = useRef(new Animated.Value(0)).current;
  const suggestionSheetScrimOpacity = useRef(new Animated.Value(0)).current;
  const suggestionSheetMountedRef = useRef(false);
  const suggestionSheetCloseActionRef = useRef<(() => void) | null>(null);
  const leaveSheetSlide = useRef(new Animated.Value(0)).current;
  const leaveSheetScrimOpacity = useRef(new Animated.Value(0)).current;
  const leaveSheetMountedRef = useRef(false);
  const leaveAfterSheetCloseRef = useRef(false);
  const followUpQuestionReveal = useRef(new Animated.Value(0)).current;
  const sessionCardRevealValues = useRef(
    Array.from(
      { length: SESSION_ANALYSIS_CARD_COUNT },
      () => new Animated.Value(0),
    ),
  ).current;
  const sessionTailRevealValues = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const goalCardRevealValues = useRef(
    Array.from({ length: 4 }, () => new Animated.Value(0)),
  ).current;
  const goalSelectionValues = useRef(
    Array.from({ length: 4 }, () => new Animated.Value(0)),
  ).current;
  const goalCtaReveal = useRef(new Animated.Value(1)).current;
  const streakFlameTilt = useRef(new Animated.Value(0)).current;
  const streakFlameReveal = useRef(new Animated.Value(0)).current;
  const streakTextReveal = useRef(new Animated.Value(0)).current;
  const streakCtaReveal = useRef(new Animated.Value(0)).current;
  const streakConfettiValues = useRef(
    STREAK_CONFETTI.map(() => new Animated.Value(0)),
  ).current;
  const completionFeatureRevealValues = useRef(
    READY_FEATURE_CARDS.map(() => new Animated.Value(0)),
  ).current;
  const completionIconShake = useRef(new Animated.Value(0)).current;
  const completionButtonReveal = useRef(new Animated.Value(0)).current;
  const completionButtonPulse = useRef(new Animated.Value(0)).current;
  const addRecentJournalEntry = useAppStore(
    state => state.addRecentJournalEntry,
  );
  const finishOnboardingV2Journey = useAppStore(
    state => state.finishOnboardingV2Journey,
  );
  const [mode, setMode] = useState<FirstReflectionMode>(
    initialStreakPayload
      ? 'streak_started'
      : initialGoalsPayload
      ? 'goals'
      : initialAnalysisPayload
      ? 'session_analysis'
      : 'core_prompts',
  );
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [visibleCorePromptIndex, setVisibleCorePromptIndex] = useState(0);
  const [isStreakCtaVisible, setIsStreakCtaVisible] = useState(false);
  const [answers, setAnswers] = useState<FirstReflectionAnswers>(
    initialStreakPayload?.answers ||
      initialGoalsPayload?.answers ||
      initialAnalysisPayload?.answers ||
      {},
  );
  const answersRef = useRef<FirstReflectionAnswers>(answers);
  const [currentInput, setCurrentInput] = useState('');
  const [isCoreInputFocused, setIsCoreInputFocused] = useState(false);
  const [isOptionalInputFocused, setIsOptionalInputFocused] = useState(false);
  const [isSuggestionSheetVisible, setIsSuggestionSheetVisible] =
    useState(false);
  const [isSuggestionSheetMounted, setIsSuggestionSheetMounted] =
    useState(false);
  const [isSuggestionSelectionPending, setIsSuggestionSelectionPending] =
    useState(false);
  const [revealedSuggestionMessageId, setRevealedSuggestionMessageId] =
    useState<string | null>(null);
  const [isFinishConfirmVisible, setIsFinishConfirmVisible] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(
    initialStreakPayload?.aiSummary ||
      initialGoalsPayload?.aiSummary ||
      initialAnalysisPayload?.aiSummary ||
      null,
  );
  const [visibleAiSummary, setVisibleAiSummary] = useState<string | null>(null);
  const [isAiSummaryStreaming, setIsAiSummaryStreaming] = useState(false);
  const [isAiSummaryComplete, setIsAiSummaryComplete] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<GuidedThreadMessage[]>(
    initialStreakPayload?.threadMessages ||
      initialGoalsPayload?.threadMessages ||
      initialAnalysisPayload?.threadMessages ||
      [],
  );
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );
  const [deeperRequestCount, setDeeperRequestCount] = useState(0);
  const [deeperError, setDeeperError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSubmittingEntry, setIsSubmittingEntry] = useState(false);
  const [sessionAnalysis] = useState<SessionAnalysis | null>(
    initialStreakPayload?.sessionAnalysis ||
      initialGoalsPayload?.sessionAnalysis ||
      initialAnalysisPayload?.sessionAnalysis ||
      null,
  );
  const [visibleSessionCardCount, setVisibleSessionCardCount] = useState(0);
  const [activeSessionTextCard, setActiveSessionTextCard] = useState(0);
  const [completedSessionTextCards, setCompletedSessionTextCards] = useState<
    number[]
  >([]);
  const [visibleCenterBreakdownRows, setVisibleCenterBreakdownRows] =
    useState(0);
  const [isCenterBreakdownExpanded, setIsCenterBreakdownExpanded] =
    useState(false);
  const [visibleSessionTailStage, setVisibleSessionTailStage] = useState(0);
  const [isLeaveConfirmVisible, setIsLeaveConfirmVisible] = useState(false);
  const [isLeaveConfirmMounted, setIsLeaveConfirmMounted] = useState(false);
  const [currentFollowUpQuestion, setCurrentFollowUpQuestion] = useState<
    string | null
  >(null);
  const [canContinueDeeper, setCanContinueDeeper] = useState(true);
  /**
   * Triggers the session has surfaced so far. Guided reflection has no
   * server-side session, so this rides here between turns exactly like the
   * thread itself does: the server sends back the full merged list, this stores
   * it untouched, and the next call sends it straight back. Never merged or
   * edited here — the server re-validates it on arrival.
   */
  const [sessionSignals, setSessionSignals] = useState<GuidedSessionTrigger[]>(
    [],
  );
  const [isCompletionCtaEnabled, setIsCompletionCtaEnabled] = useState(false);
  const [goalSuggestions, setGoalSuggestions] = useState<
    FirstReflectionGoalSuggestion[]
  >(
    () =>
      initialStreakPayload?.goalSuggestions ||
      (initialGoalsPayload
        ? createGoalSuggestionsFromPayload(
            initialGoalsPayload.goalSuggestions,
            'ai',
          )
        : []),
  );
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [visibleGoalCardCount, setVisibleGoalCardCount] = useState(0);
  const [isGoalEditorVisible, setIsGoalEditorVisible] = useState(false);

  const currentPrompt =
    FIRST_REFLECTION_PROMPTS[currentPromptIndex] || FIRST_REFLECTION_PROMPTS[0];
  const contentMaxWidth = Math.min(width - 28, 440);
  const answeredPrompts = useMemo(
    () =>
      FIRST_REFLECTION_PROMPTS.filter(prompt =>
        isMeaningfulAnswer(answers[prompt.id]),
      ),
    [answers],
  );
  const corePrompts = FIRST_REFLECTION_PROMPTS.slice(0, CORE_PROMPT_COUNT);
  const optionalPrompt = FIRST_REFLECTION_PROMPTS[3];
  const currentAnswerIsMeaningful =
    mode === 'core_prompts'
      ? isMeaningfulAnswer(answers[currentPrompt.id])
      : isMeaningfulAnswer(currentInput);
  const hasReachedDeeperLimit = deeperRequestCount >= MAX_DEEPER_REFLECTIONS;
  const isSummaryFailed = Boolean(aiSummaryError && !aiSummary);
  const isAssistantStreaming = Boolean(streamingMessageId);
  const isAiBusy =
    isThreadLoading || isAssistantStreaming || isAiSummaryStreaming;
  const canShowOptionalPrompt =
    mode === 'optional_deeper' &&
    Boolean(aiSummary) &&
    isAiSummaryComplete &&
    !isAiBusy &&
    !isSummaryFailed;
  const hasAnyEntryContent =
    currentAnswerIsMeaningful ||
    answeredPrompts.length > 0 ||
    threadMessages.some(message => message.text.trim());
  const canUsePrimary =
    mode === 'core_prompts'
      ? currentPrompt.required
        ? currentAnswerIsMeaningful
        : true
      : mode === 'optional_deeper'
      ? !isAiBusy &&
        canContinueDeeper &&
        (isSummaryFailed ||
          hasReachedDeeperLimit ||
          currentAnswerIsMeaningful ||
          !hasReachedDeeperLimit)
      : false;
  const canFinishEntry =
    !isThreadLoading && !isAiSummaryStreaming && hasAnyEntryContent;
  const activePromptForInput =
    mode === 'optional_deeper' || mode === 'deeper_loading'
      ? optionalPrompt
      : currentPrompt;
  const activeQuestion =
    mode === 'optional_deeper' || mode === 'deeper_loading'
      ? currentFollowUpQuestion || optionalPrompt.question
      : activePromptForInput.question;
  const finishActionLabel = hasAnyEntryContent ? 'Finish entry' : 'Exit';
  const primaryButtonLabel =
    mode === 'deeper_loading' || isThreadLoading || isAssistantStreaming
      ? 'Writing...'
      : mode === 'core_prompts'
      ? currentPromptIndex === CORE_PROMPT_COUNT - 1
        ? 'Go deeper'
        : 'Next prompt'
      : mode === 'optional_deeper'
      ? isSummaryFailed
        ? 'Try again'
        : hasReachedDeeperLimit || !canContinueDeeper
        ? 'Review entry'
        : currentAnswerIsMeaningful
        ? 'Go deeper'
        : 'Suggest'
      : 'Go deeper';

  const activePromptFontSize =
    mode === 'optional_deeper' || mode === 'deeper_loading'
      ? width < 380
        ? 22
        : 25
      : width < 380
      ? 25
      : 30;
  const selectedGoalCount = goalSuggestions.filter(
    goal => goal.selected,
  ).length;
  const editingGoal =
    goalSuggestions.find(goal => goal.id === editingGoalId) || null;
  // GoalSheet prefills from a SavedGoal. A suggestion has not been created yet,
  // so the persistence-only fields are filler — and with no lifecycle handlers
  // passed, the sheet never surfaces them.
  const editingGoalAsSavedGoal: SavedGoal | null = editingGoal
    ? {
        id: editingGoal.id,
        title: editingGoal.title,
        description: editingGoal.description,
        icon: editingGoal.icon,
        iconSource: editingGoal.iconSource,
        frequency: editingGoal.frequency,
        status: 'active',
        reminderEnabled: editingGoal.reminderEnabled,
        reminderTime: editingGoal.reminderTime,
        lastCompletedLocalDate: null,
        isCompletedForPeriod: false,
        createdAt: '',
        updatedAt: '',
      }
    : null;
  // Keeps automatic icon selection from colliding with the other suggestions.
  const unavailableGoalIcons = goalSuggestions
    .filter(goal => goal.id !== editingGoalId)
    .map(goal => goal.icon);
  const goalSuggestionKey = goalSuggestions.map(goal => goal.id).join('|');
  const goalRevealCount = goalSuggestionKey
    ? goalSuggestionKey.split('|').length
    : 0;

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [
    answers,
    mode,
    visibleAiSummary,
    threadMessages,
    isThreadLoading,
    isAiSummaryStreaming,
  ]);

  useEffect(() => {
    const shouldShimmer = mode === 'ai_summary_loading' || isThreadLoading;

    if (!shouldShimmer) {
      shimmerValue.stopAnimation();
      shimmerValue.setValue(0);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          duration: 760,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          duration: 760,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [isThreadLoading, mode, shimmerValue]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useEffect(() => {
    const animation = Animated.spring(coreActionsReveal, {
      toValue: isCoreInputFocused ? 0 : 1,
      damping: 16,
      mass: 0.85,
      stiffness: 220,
      useNativeDriver: false,
    });

    animation.start();

    return () => animation.stop();
  }, [coreActionsReveal, isCoreInputFocused]);

  useEffect(() => {
    const animation = Animated.spring(optionalActionsReveal, {
      toValue: isOptionalInputFocused ? 0 : 1,
      damping: 16,
      mass: 0.85,
      stiffness: 220,
      useNativeDriver: false,
    });

    animation.start();

    return () => animation.stop();
  }, [isOptionalInputFocused, optionalActionsReveal]);

  useEffect(() => {
    if (mode !== 'ai_summary_loading') {
      return undefined;
    }

    transcriptEntrance.setValue(0);
    const frameId = requestAnimationFrame(() => {
      Animated.timing(transcriptEntrance, {
        toValue: 1,
        duration: TRANSCRIPT_ENTRANCE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    return () => cancelAnimationFrame(frameId);
  }, [mode, transcriptEntrance]);

  useEffect(() => {
    const keyboardDidHideSubscription = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setIsCoreInputFocused(false);
        setIsOptionalInputFocused(false);
      },
    );

    return () => {
      keyboardDidHideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isSuggestionSheetVisible) {
      if (!suggestionSheetMountedRef.current) {
        return undefined;
      }

      const closingAnimation = Animated.parallel([
        Animated.timing(suggestionSheetSlide, {
          toValue: 0,
          duration: 230,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(suggestionSheetScrimOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      closingAnimation.start(({ finished }) => {
        if (!finished) {
          return;
        }

        suggestionSheetMountedRef.current = false;
        setIsSuggestionSheetMounted(false);
        const onClosed = suggestionSheetCloseActionRef.current;
        suggestionSheetCloseActionRef.current = null;
        onClosed?.();
      });

      return () => closingAnimation.stop();
    }

    if (suggestionSheetMountedRef.current) {
      return undefined;
    }

    suggestionSheetMountedRef.current = true;
    suggestionSheetSlide.setValue(0);
    suggestionSheetScrimOpacity.setValue(0);
    setIsSuggestionSheetMounted(true);
    const frameId = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(suggestionSheetSlide, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(suggestionSheetScrimOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => cancelAnimationFrame(frameId);
  }, [
    isSuggestionSheetVisible,
    suggestionSheetScrimOpacity,
    suggestionSheetSlide,
  ]);

  useEffect(() => {
    if (!isLeaveConfirmVisible) {
      if (!leaveSheetMountedRef.current) {
        return undefined;
      }

      const closingAnimation = Animated.parallel([
        Animated.timing(leaveSheetSlide, {
          toValue: 0,
          duration: 230,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(leaveSheetScrimOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]);
      closingAnimation.start(({ finished }) => {
        if (finished) {
          leaveSheetMountedRef.current = false;
          setIsLeaveConfirmMounted(false);
          if (leaveAfterSheetCloseRef.current) {
            leaveAfterSheetCloseRef.current = false;
            onBackToReady();
          }
        }
      });
      return () => closingAnimation.stop();
    }

    if (leaveSheetMountedRef.current) {
      return undefined;
    }

    leaveSheetMountedRef.current = true;
    leaveSheetSlide.setValue(0);
    leaveSheetScrimOpacity.setValue(0);
    setIsLeaveConfirmMounted(true);
    const frameId = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(leaveSheetSlide, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(leaveSheetScrimOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(frameId);
  }, [
    isLeaveConfirmVisible,
    leaveSheetScrimOpacity,
    leaveSheetSlide,
    onBackToReady,
  ]);

  useEffect(() => {
    if (!canShowOptionalPrompt || !currentFollowUpQuestion) {
      followUpQuestionReveal.setValue(0);
      return undefined;
    }

    followUpQuestionReveal.setValue(0);
    const animation = Animated.timing(followUpQuestionReveal, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [canShowOptionalPrompt, currentFollowUpQuestion, followUpQuestionReveal]);

  useEffect(() => {
    if (mode !== 'session_analysis') {
      sessionCardRevealValues.forEach(value => value.setValue(0));
      setVisibleSessionCardCount(0);
      setActiveSessionTextCard(0);
      setCompletedSessionTextCards([]);
      setVisibleCenterBreakdownRows(0);
      setIsCenterBreakdownExpanded(false);
      sessionTailRevealValues.forEach(value => value.setValue(0));
      setVisibleSessionTailStage(0);
      return undefined;
    }

    sessionCardRevealValues.forEach(value => value.setValue(0));
    setVisibleSessionCardCount(1);
    setActiveSessionTextCard(0);
    setCompletedSessionTextCards([]);
    setVisibleCenterBreakdownRows(0);
    setIsCenterBreakdownExpanded(false);
    sessionTailRevealValues.forEach(value => value.setValue(0));
    setVisibleSessionTailStage(0);

    return () => {
      if (sessionCardSequenceTimerRef.current) {
        clearTimeout(sessionCardSequenceTimerRef.current);
        sessionCardSequenceTimerRef.current = null;
      }
    };
  }, [mode, sessionCardRevealValues, sessionTailRevealValues]);

  useEffect(() => {
    if (mode !== 'session_analysis' || visibleSessionCardCount <= 0) {
      return undefined;
    }

    const cardIndex = visibleSessionCardCount - 1;
    const revealAnimation = Animated.timing(
      sessionCardRevealValues[cardIndex],
      {
        toValue: 1,
        duration: SESSION_ANALYSIS_CARD_REVEAL_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      },
    );

    revealAnimation.start();
    const textStartTimer = setTimeout(() => {
      setActiveSessionTextCard(visibleSessionCardCount);
    }, SESSION_ANALYSIS_CARD_REVEAL_MS + 20);

    return () => {
      revealAnimation.stop();
      clearTimeout(textStartTimer);
    };
  }, [mode, sessionCardRevealValues, visibleSessionCardCount]);

  useEffect(() => {
    if (mode !== 'session_analysis' || visibleSessionTailStage <= 0) {
      return undefined;
    }

    const tailIndex = visibleSessionTailStage - 1;
    const revealAnimation = Animated.timing(
      sessionTailRevealValues[tailIndex],
      {
        toValue: 1,
        duration: SESSION_ANALYSIS_CARD_REVEAL_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      },
    );

    revealAnimation.start();

    return () => revealAnimation.stop();
  }, [mode, sessionTailRevealValues, visibleSessionTailStage]);

  useEffect(() => {
    if (mode !== 'goals' || !goalRevealCount) {
      goalCardRevealValues.forEach(value => value.setValue(0));
      setVisibleGoalCardCount(0);
      return undefined;
    }

    goalCardRevealValues.forEach(value => value.setValue(0));
    setVisibleGoalCardCount(0);
    const timers = Array.from(
      { length: Math.min(goalRevealCount, 4) },
      (_, index) =>
        setTimeout(() => {
          setVisibleGoalCardCount(index + 1);
          Animated.timing(goalCardRevealValues[index], {
            toValue: 1,
            duration: GOAL_CARD_REVEAL_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }, index * (GOAL_CARD_REVEAL_MS + GOAL_CARD_GAP_MS)),
    );

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [goalCardRevealValues, goalRevealCount, mode]);

  useEffect(() => {
    if (mode !== 'goals') {
      return undefined;
    }

    const animations = goalSuggestions.slice(0, 4).map((goal, index) =>
      Animated.spring(goalSelectionValues[index], {
        toValue: goal.selected ? 1 : 0,
        damping: 16,
        stiffness: 220,
        mass: 0.85,
        useNativeDriver: true,
      }),
    );

    animations.forEach(animation => animation.start());

    return () => animations.forEach(animation => animation.stop());
  }, [goalSelectionValues, goalSuggestions, mode]);

  useEffect(() => {
    if (mode !== 'streak_started') {
      streakFlameTilt.setValue(0);
      streakFlameReveal.setValue(0);
      streakTextReveal.setValue(0);
      streakCtaReveal.setValue(0);
      streakConfettiValues.forEach(value => value.setValue(0));
      setIsStreakCtaVisible(false);
      return undefined;
    }

    streakFlameTilt.setValue(0);
    streakFlameReveal.setValue(0);
    streakTextReveal.setValue(0);
    streakCtaReveal.setValue(0);
    streakConfettiValues.forEach(value => value.setValue(0));
    setIsStreakCtaVisible(false);

    const flameAnimation = Animated.parallel([
      Animated.timing(streakFlameReveal, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(90),
        Animated.timing(streakFlameTilt, {
          toValue: 1,
          duration: 90,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(streakFlameTilt, {
          toValue: 2,
          duration: 100,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(streakFlameTilt, {
          toValue: 3,
          duration: 100,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(streakFlameTilt, {
          toValue: 4,
          duration: 130,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);
    const textAnimation = Animated.timing(streakTextReveal, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    const ctaAnimation = Animated.spring(streakCtaReveal, {
      toValue: 1,
      damping: 16,
      stiffness: 220,
      mass: 0.85,
      useNativeDriver: true,
    });
    const confettiAnimation = Animated.parallel(
      streakConfettiValues.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          delay: index * 28,
          duration: 640,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    );
    const entranceAnimation = Animated.sequence([
      flameAnimation,
      textAnimation,
    ]);
    triggerHaptic('streakFlame').catch(() => undefined);
    const flameHapticStopTimer = setTimeout(() => {
      stopHaptics().catch(() => undefined);
    }, STREAK_FLAME_ANIMATION_DURATION_MS);

    entranceAnimation.start(({ finished }) => {
      if (!finished) {
        return;
      }

      ctaAnimation.start(({ finished: isCtaFinished }) => {
        if (isCtaFinished) {
          setIsStreakCtaVisible(true);
        }
      });
      confettiAnimation.start();
    });

    return () => {
      entranceAnimation.stop();
      ctaAnimation.stop();
      confettiAnimation.stop();
      clearTimeout(flameHapticStopTimer);
      stopHaptics().catch(() => undefined);
    };
  }, [
    mode,
    streakConfettiValues,
    streakCtaReveal,
    streakFlameReveal,
    streakFlameTilt,
    streakTextReveal,
  ]);

  useEffect(() => {
    if (mode !== 'goals') {
      goalCtaReveal.setValue(1);
      return undefined;
    }

    goalCtaReveal.setValue(0.96);
    const animation = Animated.spring(goalCtaReveal, {
      toValue: 1,
      damping: 16,
      stiffness: 220,
      mass: 0.85,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [goalCtaReveal, mode, selectedGoalCount]);

  useEffect(() => {
    if (mode !== 'saved') {
      completionFeatureRevealValues.forEach(value => value.setValue(0));
      completionIconShake.setValue(0);
      completionButtonReveal.setValue(0);
      completionButtonPulse.setValue(0);
      setIsCompletionCtaEnabled(false);
      return undefined;
    }

    completionFeatureRevealValues.forEach(value => value.setValue(0));
    completionIconShake.setValue(0);
    completionButtonReveal.setValue(0);
    completionButtonPulse.setValue(0);
    setIsCompletionCtaEnabled(false);

    const iconAnimation = Animated.sequence([
      Animated.delay(170),
      Animated.timing(completionIconShake, {
        toValue: 1,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(completionIconShake, {
        toValue: 2,
        duration: 120,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(completionIconShake, {
        toValue: 3,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    const cardAnimation = Animated.sequence([
      Animated.delay(READY_CARD_INITIAL_DELAY_MS),
      Animated.stagger(
        READY_CARD_STAGGER_MS,
        completionFeatureRevealValues.map(value =>
          Animated.timing(value, {
            toValue: 1,
            duration: READY_CARD_DURATION_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
    ]);
    const introAnimation = Animated.parallel([iconAnimation, cardAnimation]);
    const buttonDelay =
      READY_CARD_INITIAL_DELAY_MS +
      (READY_FEATURE_CARDS.length - 1) * READY_CARD_STAGGER_MS +
      READY_CARD_DURATION_MS +
      150;
    const buttonAnimation = Animated.sequence([
      Animated.delay(buttonDelay),
      Animated.spring(completionButtonReveal, {
        toValue: 1,
        damping: 17,
        stiffness: 145,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]);
    let pulseAnimation: Animated.CompositeAnimation | null = null;

    triggerHaptic('personalizationComplete').catch(() => undefined);
    introAnimation.start();
    buttonAnimation.start(({ finished }) => {
      if (!finished) {
        return;
      }

      setIsCompletionCtaEnabled(true);
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(completionButtonPulse, {
            toValue: 1,
            duration: 950,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(completionButtonPulse, {
            toValue: 0,
            duration: 950,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(420),
        ]),
      );
      pulseAnimation.start();
    });

    return () => {
      introAnimation.stop();
      buttonAnimation.stop();
      pulseAnimation?.stop();
    };
  }, [
    completionButtonPulse,
    completionButtonReveal,
    completionFeatureRevealValues,
    completionIconShake,
    mode,
  ]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setIsLeaveConfirmVisible(true);
        triggerHaptic('back').catch(() => undefined);
        return true;
      },
    );

    return () => subscription.remove();
  }, []);

  useEffect(
    () => () => {
      if (typewriterTimerRef.current) {
        clearTimeout(typewriterTimerRef.current);
      }
      if (summaryTypewriterTimerRef.current) {
        clearTimeout(summaryTypewriterTimerRef.current);
      }
      if (sessionCardSequenceTimerRef.current) {
        clearTimeout(sessionCardSequenceTimerRef.current);
      }
    },
    [],
  );

  const getOnboardingContext = (): GuidedReflectionOnboardingContext => ({
    ageRange: draft.ageRange,
    primaryContext: draft.primaryContext,
    reflectionTone: draft.reflectionTone,
    primarySupportFocus: draft.primarySupportFocus,
    supportFocusAreas: draft.supportFocusAreas,
    preferredTheme: draft.preferredTheme,
  });

  const getCorePromptAnswers = (
    nextAnswers: FirstReflectionAnswers,
  ): FirstReflectionPromptAnswer[] =>
    corePrompts.map(prompt => ({
      questionId: prompt.id as CoreReflectionPromptId,
      question: prompt.question,
      answer: nextAnswers[prompt.id]?.trim() || '',
    }));

  const getPromptAnswersForDeeper = (
    sourceAnswers: FirstReflectionAnswers = answers,
  ): GuidedReflectionPromptAnswer[] =>
    FIRST_REFLECTION_PROMPTS.map(prompt => ({
      questionId: prompt.id,
      question: prompt.question,
      answer: sourceAnswers[prompt.id]?.trim() || '',
    })).filter(prompt => isMeaningfulAnswer(prompt.answer));

  const createThreadMessageId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const getThreadPayload = (
    messages: GuidedThreadMessage[],
  ): GuidedReflectionThreadMessagePayload[] =>
    messages
      .filter(
        (
          message,
        ): message is GuidedThreadMessage & { role: 'user' | 'assistant' } =>
          message.role !== 'system' &&
          message.kind !== 'local_error' &&
          Boolean(message.text.trim()),
      )
      .map(message => ({
        role: message.role,
        kind: message.kind,
        text: message.text.trim(),
        ...(message.actionType ? { actionType: message.actionType } : {}),
        ...(message.promptQuestion
          ? { promptQuestion: message.promptQuestion.trim() }
          : {}),
      }));

  const finishStreamingMessage = () => {
    const streaming = streamingFullTextRef.current;

    if (!streaming) {
      return threadMessages;
    }

    if (typewriterTimerRef.current) {
      clearTimeout(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }

    const nextMessages = threadMessages.map(message =>
      message.id === streaming.id
        ? {
            ...message,
            text: streaming.fullText,
            isStreaming: false,
          }
        : message,
    );

    setThreadMessages(nextMessages);
    streamingFullTextRef.current = null;
    setStreamingMessageId(null);
    setDeeperRequestCount(count => count + 1);
    return nextMessages;
  };

  const startSummaryTypewriter = (fullText: string) => {
    const chunks = fullText.match(/\S+\s*/g) || [fullText];

    if (summaryTypewriterTimerRef.current) {
      clearTimeout(summaryTypewriterTimerRef.current);
    }

    summaryFullTextRef.current = fullText;
    setVisibleAiSummary('');
    setIsAiSummaryComplete(false);
    setIsAiSummaryStreaming(true);

    let index = 0;
    const revealNextChunk = () => {
      index += 1;
      setVisibleAiSummary(chunks.slice(0, index).join(''));
      scrollRef.current?.scrollToEnd({ animated: true });

      if (index < chunks.length) {
        summaryTypewriterTimerRef.current = setTimeout(
          revealNextChunk,
          TYPEWRITER_CHUNK_MS,
        );
        return;
      }

      summaryTypewriterTimerRef.current = null;
      summaryFullTextRef.current = null;
      setIsAiSummaryStreaming(false);
      setIsAiSummaryComplete(true);
      triggerHaptic('animationCue').catch(() => undefined);
    };

    summaryTypewriterTimerRef.current = setTimeout(revealNextChunk, 140);
  };

  const startAssistantTypewriter = (fullText: string) => {
    const messageId = createThreadMessageId();
    const chunks = fullText.match(/\S+\s*/g) || [fullText];
    const createdAt = Date.now();

    if (typewriterTimerRef.current) {
      clearTimeout(typewriterTimerRef.current);
    }

    streamingFullTextRef.current = {
      id: messageId,
      fullText,
    };
    setStreamingMessageId(messageId);
    setThreadMessages(currentMessages => [
      ...currentMessages,
      {
        id: messageId,
        role: 'assistant',
        kind: 'assistant_reflection',
        text: '',
        createdAt,
        isStreaming: true,
      },
    ]);

    let index = 0;
    const revealNextChunk = () => {
      index += 1;
      const visibleText = chunks.slice(0, index).join('');

      setThreadMessages(currentMessages =>
        currentMessages.map(message =>
          message.id === messageId
            ? {
                ...message,
                text: visibleText,
                isStreaming: index < chunks.length,
              }
            : message,
        ),
      );

      scrollRef.current?.scrollToEnd({ animated: true });

      if (index < chunks.length) {
        typewriterTimerRef.current = setTimeout(
          revealNextChunk,
          TYPEWRITER_CHUNK_MS,
        );
        return;
      }

      typewriterTimerRef.current = null;
      streamingFullTextRef.current = null;
      setStreamingMessageId(null);
      setDeeperRequestCount(count => count + 1);
    };

    typewriterTimerRef.current = setTimeout(revealNextChunk, 60);
  };

  const updateCoreAnswer = (
    promptId: FirstReflectionPromptId,
    value: string,
  ) => {
    const nextAnswers = {
      ...answersRef.current,
      [promptId]: value,
    };

    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
  };

  const submitFirstReflection = async (
    nextAnswers: FirstReflectionAnswers,
    nextThreadMessages: GuidedThreadMessage[],
  ) => {
    const { content, appAuthoredSegments } = composeFirstReflectionEntry({
      answers: nextAnswers,
      aiSummary,
      threadMessages: nextThreadMessages,
    });

    if (!content.trim() || isSubmittingEntry) {
      setSaveError('Add a little more before finishing this reflection.');
      return;
    }

    Keyboard.dismiss();
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    setSaveError(null);
    setIsSubmittingEntry(true);
    triggerHaptic('primaryAction').catch(() => undefined);

    try {
      const savedEntry = await createJournalEntry({
        title: getGeneratedTitle(),
        content,
        type: 'guided',
        aiPrompt: 'Onboarding first guided reflection',
        appAuthoredSegments,
      });

      addRecentJournalEntry(savedEntry);

      let analysis = createFallbackSessionAnalysis({
        answers: nextAnswers,
        aiSummary,
        draft,
      });

      try {
        analysis = await createGuidedReflectionSessionAnalysis({
          journalId: savedEntry._id,
          promptAnswers: getPromptAnswersForDeeper(nextAnswers),
          aiSummary: aiSummary || undefined,
          threadMessages: getThreadPayload(nextThreadMessages),
          sessionSignals,
          onboardingContext: getOnboardingContext(),
        });
      } catch {
        analysis = createFallbackSessionAnalysis({
          answers: nextAnswers,
          aiSummary,
          draft,
        });
      }

      setIsSubmittingEntry(false);
      triggerHaptic('personalizationComplete').catch(() => undefined);
      onAnalysisReady?.({
        answers: nextAnswers,
        aiSummary,
        draft,
        journalId: savedEntry._id,
        sessionAnalysis: analysis,
        threadMessages: nextThreadMessages,
      });
    } catch {
      setIsSubmittingEntry(false);
      setSaveError("We couldn't save this reflection yet. Please try again.");
    }
  };

  const loadFirstSummary = async (
    nextAnswers: FirstReflectionAnswers,
    animateCoreExit = false,
  ) => {
    if (animateCoreExit) {
      await new Promise<void>(resolve => {
        Animated.timing(coreToTranscriptExit, {
          toValue: 0.62,
          duration: Math.min(CORE_TO_TRANSCRIPT_EXIT_MS, 120),
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(() => resolve());
      });
      coreToTranscriptExit.setValue(1);
    }

    transcriptEntrance.setValue(0.72);
    setMode('ai_summary_loading');
    setAiSummaryError(null);
    setVisibleAiSummary(null);
    setIsAiSummaryComplete(false);
    setIsAiSummaryStreaming(false);
    setCurrentInput('');
    triggerHaptic('primaryAction').catch(() => undefined);

    try {
      const summary = await createFirstReflectionSummary({
        promptAnswers: getCorePromptAnswers(nextAnswers),
        onboardingContext: getOnboardingContext(),
      });

      setAiSummary(summary.reflection);
      setSessionSignals(summary.sessionSignals?.triggers || []);
      setCurrentFollowUpQuestion(summary.followUpQuestion.trim());
      setCanContinueDeeper(true);
      setCurrentInput('');
      setMode('optional_deeper');
      startSummaryTypewriter(summary.reflection.trim());
    } catch {
      setAiSummaryError(
        "We couldn't create a deeper reflection right now. You can try again or finish your entry.",
      );
      setIsAiSummaryStreaming(false);
      setIsAiSummaryComplete(false);
      setMode('optional_deeper');
    }
  };

  const runDeeperThreadRequest = async ({
    text,
    actionType,
  }: {
    text: string;
    actionType?: GuidedSuggestionAction;
  }) => {
    const trimmedText = text.trim();

    if (
      !isMeaningfulAnswer(trimmedText) ||
      deeperRequestCount >= MAX_DEEPER_REFLECTIONS ||
      isThreadLoading ||
      streamingMessageId
    ) {
      return;
    }

    const userMessage: GuidedThreadMessage = {
      id: createThreadMessageId(),
      role: 'user',
      kind: actionType ? 'suggestion_request' : 'typed_deeper_request',
      text: trimmedText,
      actionType,
      ...(currentFollowUpQuestion
        ? { promptQuestion: currentFollowUpQuestion }
        : {}),
      createdAt: Date.now(),
    };
    const nextThreadMessages = [...threadMessages, userMessage];

    if (actionType) {
      suggestionRequestReveal.setValue(0);
      setRevealedSuggestionMessageId(userMessage.id);
      requestAnimationFrame(() => {
        Animated.timing(suggestionRequestReveal, {
          toValue: 1,
          duration: SUGGESTION_REQUEST_REVEAL_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    }

    setThreadMessages(nextThreadMessages);
    setMode('deeper_loading');
    setIsThreadLoading(true);
    setDeeperError(null);
    setCurrentInput('');
    setCurrentFollowUpQuestion(null);
    triggerHaptic('primaryAction').catch(() => undefined);

    try {
      const deeper = await createGuidedReflectionDeeperResponse({
        promptAnswers: getPromptAnswersForDeeper(),
        aiSummary: aiSummary || undefined,
        previousDeeperReflections: nextThreadMessages
          .filter(
            message =>
              message.role === 'assistant' &&
              message.kind === 'assistant_reflection',
          )
          .map(message => message.text),
        threadMessages: getThreadPayload(nextThreadMessages),
        currentText: trimmedText,
        suggestionAction: actionType,
        previousSignals: sessionSignals,
        onboardingContext: getOnboardingContext(),
      });
      setIsThreadLoading(false);
      setSessionSignals(deeper.sessionSignals?.triggers || sessionSignals);
      setCurrentFollowUpQuestion(deeper.nextQuestion.trim());
      setCanContinueDeeper(deeper.canGoDeeper);
      setMode('optional_deeper');
      startAssistantTypewriter(deeper.reflection.trim());
    } catch {
      const errorMessage = actionType
        ? "Journal.IO couldn't respond right now. Your writing is still safe here."
        : "We couldn't go deeper right now. Please try again or finish your entry.";

      setThreadMessages([
        ...nextThreadMessages,
        {
          id: createThreadMessageId(),
          role: 'system',
          kind: 'local_error',
          text: errorMessage,
          createdAt: Date.now(),
        },
      ]);
      if (!actionType) {
        setCurrentInput(trimmedText);
      }
      setCurrentFollowUpQuestion(userMessage.promptQuestion || null);
      setDeeperError(errorMessage);
      setIsThreadLoading(false);
      setMode('optional_deeper');
    }
  };

  const scrollToCorePrompt = (index: number, focusInput = false) => {
    const nextIndex = Math.max(0, Math.min(index, currentPromptIndex));
    if (nextIndex < currentPromptIndex && !focusInput) {
      Keyboard.dismiss();
    }
    setVisibleCorePromptIndex(nextIndex);
    corePagerRef.current?.scrollTo({
      x: nextIndex * contentMaxWidth,
      animated: true,
    });

    if (focusInput) {
      setTimeout(() => coreInputRefs.current[nextIndex]?.focus(), 280);
    }
  };

  const submitCoreAnswer = () => {
    const isLastCorePrompt = currentPromptIndex === CORE_PROMPT_COUNT - 1;
    triggerHaptic('primaryAction').catch(() => undefined);

    if (isLastCorePrompt) {
      Keyboard.dismiss();
      loadFirstSummary(answersRef.current, true).catch(() => undefined);
      return;
    }

    const nextIndex = currentPromptIndex + 1;
    setCurrentPromptIndex(nextIndex);
    setVisibleCorePromptIndex(nextIndex);
    requestAnimationFrame(() => {
      corePagerRef.current?.scrollTo({
        x: nextIndex * contentMaxWidth,
        animated: true,
      });
    });

    Keyboard.dismiss();
  };

  const handlePrimaryPress = () => {
    if (mode === 'optional_deeper') {
      if (isSummaryFailed) {
        loadFirstSummary(answers).catch(() => undefined);
        return;
      }

      if (hasReachedDeeperLimit) {
        submitFirstReflection(answers, finishStreamingMessage()).catch(
          () => undefined,
        );
        return;
      }

      if (!currentAnswerIsMeaningful) {
        Keyboard.dismiss();
        suggestionSheetCloseActionRef.current = null;
        setIsSuggestionSheetVisible(true);
        triggerHaptic('bottomSheet').catch(() => undefined);
        return;
      }

      runDeeperThreadRequest({ text: currentInput }).catch(() => undefined);
      return;
    }

    if (mode !== 'core_prompts') {
      return;
    }

    if (!canUsePrimary) {
      return;
    }

    submitCoreAnswer();
  };

  const handleFinishEntryPress = () => {
    if (!hasAnyEntryContent) {
      Keyboard.dismiss();
      setIsLeaveConfirmVisible(true);
      triggerHaptic('bottomSheet').catch(() => undefined);
      return;
    }

    if (!canFinishEntry) {
      return;
    }

    const completedThreadMessages = finishStreamingMessage();
    const nextThreadMessages =
      mode === 'optional_deeper' && currentInput.trim()
        ? [
            ...completedThreadMessages,
            {
              id: createThreadMessageId(),
              role: 'user' as const,
              kind: 'typed_deeper_request' as const,
              text: currentInput.trim(),
              ...(currentFollowUpQuestion
                ? { promptQuestion: currentFollowUpQuestion }
                : {}),
              createdAt: Date.now(),
            },
          ]
        : completedThreadMessages;
    const nextAnswers = answers;
    const nextRequiredCount = FIRST_REFLECTION_PROMPTS.filter(
      prompt => prompt.required && isMeaningfulAnswer(nextAnswers[prompt.id]),
    ).length;

    if (nextRequiredCount < 3) {
      setIsFinishConfirmVisible(true);
      triggerHaptic('secondaryAction').catch(() => undefined);
      return;
    }

    submitFirstReflection(nextAnswers, nextThreadMessages).catch(
      () => undefined,
    );
  };

  const handleConfirmFinish = () => {
    setIsFinishConfirmVisible(false);
    const nextAnswers = answers;
    submitFirstReflection(nextAnswers, finishStreamingMessage()).catch(
      () => undefined,
    );
  };

  const dismissSuggestionSheet = (onClosed?: () => void) => {
    if (!onClosed) {
      setIsSuggestionSelectionPending(false);
    }
    suggestionSheetCloseActionRef.current = onClosed || null;
    setIsSuggestionSheetVisible(false);
  };

  const handleSelectSuggestion = (
    option: (typeof SUGGESTION_OPTIONS)[number],
  ) => {
    if (isSuggestionSelectionPending) {
      return;
    }

    setIsSuggestionSelectionPending(true);
    dismissSuggestionSheet(() => {
      runDeeperThreadRequest({
        text: option.requestText,
        actionType: option.actionType,
      })
        .catch(() => undefined)
        .finally(() => setIsSuggestionSelectionPending(false));
    });
    triggerHaptic('optionSelected').catch(() => undefined);
  };

  const handleContinueAfterSave = () => {
    finishOnboardingV2Journey(draft.displayName, draft).catch(() => {
      setSaveError('Your reflection is saved. Please try continuing again.');
    });
  };

  const loadGoalSuggestions = async () => {
    let nextGoalPayload = FALLBACK_GOAL_SUGGESTIONS;

    setIsLoadingGoals(true);
    setGoalsError(null);
    triggerHaptic('primaryAction').catch(() => undefined);

    try {
      const goals = loadGoalSuggestionsOverride
        ? await loadGoalSuggestionsOverride()
        : (
            await createGuidedReflectionGoalSuggestions({
              promptAnswers: getPromptAnswersForDeeper(),
              aiSummary: aiSummary || undefined,
              threadMessages: getThreadPayload(threadMessages),
              sessionAnalysis: sessionAnalysis || undefined,
              onboardingContext: getOnboardingContext(),
            })
          ).goals;
      nextGoalPayload = goals.length ? goals : FALLBACK_GOAL_SUGGESTIONS;
    } catch {
      nextGoalPayload = FALLBACK_GOAL_SUGGESTIONS;
    }

    setIsLoadingGoals(false);

    if (onGoalsReady && sessionAnalysis) {
      onGoalsReady({
        answers,
        aiSummary,
        draft,
        journalId:
          initialGoalsPayload?.journalId || initialAnalysisPayload?.journalId,
        goalSuggestions: nextGoalPayload,
        sessionAnalysis,
        threadMessages,
      });
      return;
    }

    setGoalSuggestions(
      createGoalSuggestionsFromPayload(nextGoalPayload, 'fallback'),
    );
    setMode('goals');
  };

  const toggleGoalSelection = (goalId: string) => {
    setGoalSuggestions(currentGoals =>
      currentGoals.map(goal =>
        goal.id === goalId ? { ...goal, selected: !goal.selected } : goal,
      ),
    );
    triggerHaptic('optionSelected').catch(() => undefined);
  };

  const openGoalEditor = (goal: FirstReflectionGoalSuggestion) => {
    setEditingGoalId(goal.id);
    setIsGoalEditorVisible(true);
    triggerHaptic('secondaryAction').catch(() => undefined);
  };

  const closeGoalEditor = () => {
    setIsGoalEditorVisible(false);
    setEditingGoalId(null);
  };

  // GoalSheet emits the same GoalDraft the Home card does, so an edited
  // suggestion carries its icon, frequency and reminder straight into the goal
  // that gets created.
  const applyEditedGoal = (goalDraft: GoalDraft) => {
    if (!editingGoalId) {
      return;
    }

    setGoalSuggestions(currentGoals =>
      currentGoals.map(goal =>
        goal.id === editingGoalId
          ? {
              ...goal,
              title: goalDraft.title.trim() || goal.title,
              description: goalDraft.description?.trim() || goal.description,
              icon: goalDraft.icon ?? goal.icon,
              iconSource: goalDraft.iconSource ?? goal.iconSource,
              frequency: goalDraft.frequency ?? goal.frequency,
              reminderEnabled: goalDraft.reminderEnabled ?? false,
              reminderTime: goalDraft.reminderTime ?? null,
              selected: true,
            }
          : goal,
      ),
    );
    closeGoalEditor();
    triggerHaptic('primaryAction').catch(() => undefined);
  };

  const continueFromGoals = async () => {
    if (isSavingGoals) {
      return;
    }

    triggerHaptic('primaryAction').catch(() => undefined);

    if (onGoalsSaved) {
      setIsSavingGoals(true);
      setGoalsError(null);

      try {
        await onGoalsSaved(
          goalSuggestions
            .filter(goal => goal.selected && goal.title.trim())
            .map(goal => ({
              title: goal.title.trim(),
              description: goal.description?.trim() || null,
              icon: goal.icon,
              iconSource: goal.iconSource,
              frequency: goal.frequency,
              reminderEnabled: goal.reminderEnabled,
              reminderTime: goal.reminderTime,
            })),
        );
      } catch {
        setGoalsError(
          "Your reflection is saved, but we couldn't add those goals yet. Please try again.",
        );
        setIsSavingGoals(false);
        return;
      }

      // Callers that navigate from inside onGoalsSaved pass no onMindMapReady,
      // so falling through lets onboarding both save and continue.
      if (!onMindMapReady) {
        return;
      }
    }

    if (onMindMapReady && sessionAnalysis) {
      onMindMapReady({
        answers,
        aiSummary,
        draft,
        goalSuggestions,
        sessionAnalysis,
        threadMessages,
      });
      return;
    }

    setMode('streak_started');
  };

  const continueFromStreak = () => {
    if (onRemindersReady) {
      onRemindersReady();
      triggerHaptic('primaryAction').catch(() => undefined);
      return;
    }

    setMode('saved');
    triggerHaptic('primaryAction').catch(() => undefined);
  };

  const renderAssistantCard = ({
    text,
    isStreaming = false,
    marginTop = 20,
    cardKey,
  }: {
    text: string;
    isStreaming?: boolean;
    marginTop?: number;
    cardKey?: string;
  }) => (
    <View
      key={cardKey}
      style={[
        styles.reflectionCard,
        {
          backgroundColor: hexToRgba(
            theme.colors.card,
            theme.mode === 'dark' ? 0.76 : 0.94,
          ),
          borderColor: hexToRgba(
            theme.colors.primary,
            theme.mode === 'dark' ? 0.24 : 0.16,
          ),
          marginTop,
        },
      ]}
    >
      <View
        style={[
          styles.assistantIcon,
          { backgroundColor: hexToRgba(theme.colors.primary, 0.12) },
        ]}
      >
        <Sparkles color={theme.colors.primary} size={15} strokeWidth={1.8} />
      </View>
      <View style={styles.reflectionCardBody}>
        <Text
          style={[
            styles.reflectionCardEyebrow,
            { color: theme.colors.primary },
          ]}
        >
          JOURNAL.IO
        </Text>
        <Text
          style={[
            styles.reflectionCardText,
            { color: theme.colors.foreground },
          ]}
        >
          {text}
          {isStreaming ? ' ' : ''}
        </Text>
      </View>
    </View>
  );

  const renderAssistantShimmerCard = ({
    marginTop = 20,
  }: { marginTop?: number } = {}) => {
    const shimmerOpacity = shimmerValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.42, 0.82],
    });

    return (
      <View
        style={[
          styles.reflectionCard,
          {
            backgroundColor: hexToRgba(
              theme.colors.card,
              theme.mode === 'dark' ? 0.7 : 0.92,
            ),
            borderColor: hexToRgba(
              theme.colors.primary,
              theme.mode === 'dark' ? 0.2 : 0.14,
            ),
            marginTop,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.shimmerIcon,
            {
              backgroundColor: hexToRgba(theme.colors.primary, 0.14),
              opacity: shimmerOpacity,
            },
          ]}
        />
        <View style={styles.reflectionCardBody}>
          <Animated.View
            style={[
              styles.skeletonEyebrow,
              {
                backgroundColor: hexToRgba(theme.colors.primary, 0.16),
                opacity: shimmerOpacity,
              },
            ]}
          />
          {[0, 1, 2, 3].map(index => (
            <Animated.View
              key={index}
              style={[
                styles.skeletonLine,
                index === 3 ? styles.skeletonLineShort : undefined,
                {
                  backgroundColor: hexToRgba(
                    theme.colors.foreground,
                    theme.mode === 'dark' ? 0.14 : 0.1,
                  ),
                  opacity: shimmerOpacity,
                },
              ]}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderAnsweredPrompt = (prompt: FirstReflectionPrompt) => {
    const answer = answers[prompt.id]?.trim();

    if (!answer) {
      return null;
    }

    return (
      <View
        key={prompt.id}
        testID={`guided-answer-${prompt.id}`}
        style={styles.entryBlock}
      >
        <Text style={[styles.promptText, { color: theme.colors.primary }]}>
          {prompt.question}
        </Text>
        <Text style={[styles.answerText, { color: theme.colors.foreground }]}>
          {answer}
        </Text>
      </View>
    );
  };

  const renderTopBar = () => (
    <View style={styles.topBar}>
      <View style={styles.iconButtonSpacer} />
      <View style={styles.topBarWordmark}>
        <JournalWordmark accessibilityLabel="Journal.IO" size="compact" />
      </View>
      <View style={styles.iconButtonSpacer} />
    </View>
  );

  const renderCorePromptPager = () => {
    const unlockedPrompts = corePrompts.slice(0, currentPromptIndex + 1);
    const isViewingEarlierAnswer = visibleCorePromptIndex < currentPromptIndex;
    const primaryLabel = isViewingEarlierAnswer
      ? 'Continue writing'
      : currentPromptIndex === CORE_PROMPT_COUNT - 1
      ? 'Go deeper'
      : 'Next prompt';

    return (
      <Animated.View
        style={[
          styles.coreReflectionShell,
          {
            maxWidth: contentMaxWidth,
            opacity: coreToTranscriptExit,
            transform: [
              {
                translateY: coreToTranscriptExit.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-14, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.coreProgressRow}>
          <Text
            style={[
              styles.coreProgressText,
              { color: theme.colors.mutedForeground },
            ]}
          >
            Question {visibleCorePromptIndex + 1} of {CORE_PROMPT_COUNT}
          </Text>
          <View
            accessibilityLabel="Guided reflection progress"
            style={styles.coreProgressDots}
          >
            {corePrompts.map((prompt, index) => {
              const isUnlocked = index <= currentPromptIndex;
              const isActive = index === visibleCorePromptIndex;

              return (
                <HapticPressable
                  key={prompt.id}
                  accessibilityLabel={`Go to question ${index + 1}`}
                  accessibilityRole="button"
                  disabled={!isUnlocked}
                  onPress={() => isUnlocked && scrollToCorePrompt(index)}
                  style={({ pressed }) => [
                    styles.coreProgressDot,
                    {
                      backgroundColor: isActive
                        ? theme.colors.primary
                        : isUnlocked
                        ? hexToRgba(theme.colors.primary, 0.35)
                        : hexToRgba(theme.colors.border, 0.8),
                      opacity: isUnlocked ? 1 : 0.55,
                    },
                    pressed && isUnlocked && styles.pressed,
                  ]}
                />
              );
            })}
          </View>
        </View>

        <ScrollView
          ref={corePagerRef}
          horizontal
          pagingEnabled
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="never"
          onMomentumScrollEnd={({ nativeEvent }) => {
            const index = Math.max(
              0,
              Math.min(
                Math.round(nativeEvent.contentOffset.x / contentMaxWidth),
                currentPromptIndex,
              ),
            );
            if (index < currentPromptIndex) {
              Keyboard.dismiss();
            }
            setVisibleCorePromptIndex(index);
          }}
          showsHorizontalScrollIndicator={false}
          style={styles.corePager}
          testID="guided-core-pager"
        >
          {unlockedPrompts.map((prompt, index) => (
            <View
              key={prompt.id}
              style={[styles.corePromptPage, { width: contentMaxWidth }]}
            >
              <View style={styles.corePromptPageContent}>
                <Text
                  style={[
                    styles.corePromptTitle,
                    { color: theme.colors.primary },
                  ]}
                >
                  {prompt.question}
                </Text>
                <Text
                  style={[
                    styles.corePromptHelper,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  {getToneAdjustedHelperText(prompt, draft)}
                </Text>
                <View style={styles.corePromptInputWrap}>
                  <TextInput
                    accessibilityLabel={`Write your answer to: ${prompt.question}`}
                    editable={!isSubmittingEntry}
                    inputAccessoryViewID={
                      FIRST_GUIDED_REFLECTION_KEYBOARD_ACCESSORY_ID
                    }
                    multiline
                    onBlur={() => setIsCoreInputFocused(false)}
                    onChangeText={value => updateCoreAnswer(prompt.id, value)}
                    onEndEditing={() => setIsCoreInputFocused(false)}
                    onFocus={() => {
                      setVisibleCorePromptIndex(index);
                      setIsCoreInputFocused(true);
                    }}
                    placeholder="Write"
                    placeholderTextColor={theme.colors.mutedForeground}
                    ref={element => {
                      coreInputRefs.current[index] = element;
                    }}
                    returnKeyType="default"
                    scrollEnabled
                    style={[
                      styles.corePromptInput,
                      { color: theme.colors.foreground },
                    ]}
                    textAlignVertical="top"
                    value={answers[prompt.id] || ''}
                  />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <Animated.View
          pointerEvents={isCoreInputFocused ? 'none' : 'auto'}
          testID="guided-core-actions"
          style={[
            styles.reflectionActionReveal,
            {
              height: coreActionsReveal.interpolate({
                inputRange: [0, 1],
                outputRange: [0, REFLECTION_ACTION_ROW_HEIGHT],
              }),
              opacity: coreActionsReveal,
              transform: [
                {
                  translateY: coreActionsReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.coreActionRow}>
            {/* Before anything is written this action is only an "Exit", which
                offers a way out of onboarding at the exact moment the user has
                nothing invested yet. It appears once there is something to
                finish. */}
            {hasAnyEntryContent ? (
              <HapticPressable
                accessibilityLabel={
                  isSubmittingEntry ? 'Finishing entry' : finishActionLabel
                }
                accessibilityRole="button"
                accessibilityState={{ busy: isSubmittingEntry }}
                disabled={isSubmittingEntry}
                onPress={handleFinishEntryPress}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    backgroundColor: theme.colors.secondary,
                    borderColor: theme.colors.border,
                    opacity: isSubmittingEntry ? 0.72 : 1,
                  },
                  pressed && !isSubmittingEntry && styles.pressed,
                ]}
              >
                <ButtonLoadingContent
                  loaderColor={theme.colors.foreground}
                  loading={isSubmittingEntry}
                  loader={
                    <GuidedFinishLoader
                      active={isSubmittingEntry}
                      color={theme.colors.foreground}
                    />
                  }
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    {finishActionLabel}
                  </Text>
                </ButtonLoadingContent>
              </HapticPressable>
            ) : null}
            <HapticPressable
              accessibilityLabel={primaryLabel}
              accessibilityRole="button"
              disabled={!isViewingEarlierAnswer && !canUsePrimary}
              onPress={() => {
                if (isViewingEarlierAnswer) {
                  scrollToCorePrompt(currentPromptIndex, true);
                  return;
                }
                handlePrimaryPress();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor:
                    isViewingEarlierAnswer || canUsePrimary
                      ? theme.colors.primary
                      : theme.colors.muted,
                  opacity: isViewingEarlierAnswer || canUsePrimary ? 1 : 0.62,
                },
                pressed &&
                  (isViewingEarlierAnswer || canUsePrimary) &&
                  styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  {
                    color:
                      isViewingEarlierAnswer || canUsePrimary
                        ? theme.colors.primaryForeground
                        : theme.colors.mutedForeground,
                  },
                ]}
              >
                {primaryLabel}
              </Text>
            </HapticPressable>
          </View>
        </Animated.View>
      </Animated.View>
    );
  };

  const renderWritingMode = () => (
    <>
      {renderTopBar()}
      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios' && mode === 'core_prompts'
            ? 'padding'
            : undefined
        }
        style={styles.keyboardRoot}
      >
      {mode === 'core_prompts' ? (
        renderCorePromptPager()
      ) : (
        <Animated.View
          testID="guided-reflection-transcript"
          style={[
            styles.transcriptTransition,
            {
              opacity: transcriptEntrance,
              transform: [
                {
                  translateY: transcriptEntrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <ScrollView
            ref={scrollRef}
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={[
              styles.scrollContent,
              { maxWidth: contentMaxWidth },
            ]}
            keyboardDismissMode={
              Platform.OS === 'ios' ? 'interactive' : 'on-drag'
            }
            keyboardShouldPersistTaps="never"
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: true })
            }
            showsVerticalScrollIndicator={false}
          >
            {corePrompts.map(renderAnsweredPrompt)}

            {mode === 'ai_summary_loading'
              ? renderAssistantShimmerCard({ marginTop: 28 })
              : null}

            {visibleAiSummary !== null
              ? renderAssistantCard({
                  text: visibleAiSummary,
                  isStreaming: isAiSummaryStreaming,
                  marginTop: 20,
                })
              : null}

            {aiSummaryError ? (
              <View
                style={[
                  styles.errorCard,
                  {
                    backgroundColor: hexToRgba(theme.colors.destructive, 0.08),
                    borderColor: hexToRgba(theme.colors.destructive, 0.2),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.errorCardText,
                    { color: theme.colors.foreground },
                  ]}
                >
                  {aiSummaryError}
                </Text>
                <HapticPressable
                  accessibilityLabel="Try deeper reflection again"
                  accessibilityRole="button"
                  onPress={() =>
                    loadFirstSummary(answers).catch(() => undefined)
                  }
                  style={({ pressed }) => [
                    styles.inlineRetryButton,
                    { borderColor: theme.colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    Try again
                  </Text>
                </HapticPressable>
              </View>
            ) : null}

            {threadMessages.map(item => {
              if (item.kind === 'local_error') {
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.errorCard,
                      {
                        backgroundColor: hexToRgba(
                          theme.colors.destructive,
                          0.08,
                        ),
                        borderColor: hexToRgba(theme.colors.destructive, 0.2),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.errorCardText,
                        { color: theme.colors.foreground },
                      ]}
                    >
                      {item.text}
                    </Text>
                  </View>
                );
              }

              if (item.role === 'user') {
                const isRevealingSuggestion =
                  item.id === revealedSuggestionMessageId;

                return (
                  <Animated.View
                    key={item.id}
                    testID={
                      isRevealingSuggestion
                        ? 'guided-suggestion-request'
                        : undefined
                    }
                    style={
                      isRevealingSuggestion
                        ? {
                            opacity: suggestionRequestReveal,
                            transform: [
                              {
                                translateY: suggestionRequestReveal.interpolate(
                                  {
                                    inputRange: [0, 1],
                                    outputRange: [12, 0],
                                  },
                                ),
                              },
                            ],
                          }
                        : undefined
                    }
                  >
                    <View
                      style={[
                        styles.threadUserLine,
                        {
                          backgroundColor: hexToRgba(
                            theme.colors.secondary,
                            theme.mode === 'dark' ? 0.72 : 0.9,
                          ),
                          borderColor: hexToRgba(theme.colors.border, 0.76),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          item.promptQuestion
                            ? styles.threadQuestionText
                            : styles.threadUserText,
                          {
                            color: item.promptQuestion
                              ? theme.colors.primary
                              : theme.colors.mutedForeground,
                          },
                        ]}
                      >
                        {item.promptQuestion || 'YOUR RESPONSE'}
                      </Text>
                      <Text
                        style={[
                          styles.threadUserRequestText,
                          { color: theme.colors.foreground },
                        ]}
                      >
                        {item.text}
                      </Text>
                    </View>
                  </Animated.View>
                );
              }

              return renderAssistantCard({
                text: item.text,
                isStreaming: item.isStreaming,
                marginTop: 18,
                cardKey: item.id,
              });
            })}

            {isThreadLoading
              ? renderAssistantShimmerCard({ marginTop: 18 })
              : null}

            {deeperError ? (
              <Text
                style={[styles.errorText, { color: theme.colors.destructive }]}
              >
                {deeperError}
              </Text>
            ) : null}

            {canShowOptionalPrompt && !isSummaryFailed ? (
              <Animated.View
                style={[
                  styles.activePromptWrap,
                  currentFollowUpQuestion
                    ? {
                        opacity: followUpQuestionReveal,
                        transform: [
                          {
                            translateY: followUpQuestionReveal.interpolate({
                              inputRange: [0, 1],
                              outputRange: [8, 0],
                            }),
                          },
                        ],
                      }
                    : undefined,
                ]}
              >
                <Text
                  style={[
                    currentFollowUpQuestion
                      ? styles.followUpPrompt
                      : styles.activePrompt,
                    {
                      color: theme.colors.primary,
                      fontSize: currentFollowUpQuestion
                        ? width < 380
                          ? 19
                          : 21
                        : activePromptFontSize,
                      lineHeight: currentFollowUpQuestion
                        ? width < 380
                          ? 25
                          : 27
                        : activePromptFontSize + 6,
                    },
                  ]}
                >
                  {activeQuestion}
                </Text>
                <TextInput
                  accessibilityLabel={`Write your answer to: ${activeQuestion}`}
                  editable={!isAssistantStreaming}
                  inputAccessoryViewID={
                    FIRST_GUIDED_REFLECTION_KEYBOARD_ACCESSORY_ID
                  }
                  ref={inputRef}
                  multiline
                  onBlur={() => setIsOptionalInputFocused(false)}
                  onFocus={() => {
                    setIsOptionalInputFocused(true);
                    setTimeout(
                      () => scrollRef.current?.scrollToEnd({ animated: true }),
                      80,
                    );
                  }}
                  onChangeText={setCurrentInput}
                  onEndEditing={() => setIsOptionalInputFocused(false)}
                  placeholder="Write"
                  placeholderTextColor={theme.colors.mutedForeground}
                  returnKeyType="default"
                  scrollEnabled
                  style={[
                    styles.optionalInlineInput,
                    { color: theme.colors.foreground },
                  ]}
                  textAlignVertical="top"
                  value={currentInput}
                />
              </Animated.View>
            ) : null}
          </ScrollView>

          {canShowOptionalPrompt || isSummaryFailed ? (
            <Animated.View
              pointerEvents={isOptionalInputFocused ? 'none' : 'auto'}
              testID="guided-reflection-actions"
              style={[
                styles.reflectionActionReveal,
                {
                  height: optionalActionsReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, REFLECTION_ACTION_ROW_HEIGHT],
                  }),
                  opacity: optionalActionsReveal,
                  transform: [
                    {
                      translateY: optionalActionsReveal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.actionRow}>
                <HapticPressable
                  accessibilityLabel={
                    isSubmittingEntry ? 'Finishing entry' : finishActionLabel
                  }
                  accessibilityRole="button"
                  accessibilityState={{ busy: isSubmittingEntry }}
                  disabled={isThreadLoading || isSubmittingEntry}
                  onPress={handleFinishEntryPress}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    {
                      backgroundColor:
                        mode !== 'deeper_loading'
                          ? theme.colors.secondary
                          : theme.colors.muted,
                      borderColor: theme.colors.border,
                      opacity:
                        !isThreadLoading && !isSubmittingEntry ? 1 : 0.58,
                    },
                    pressed &&
                      !isThreadLoading &&
                      !isSubmittingEntry &&
                      styles.pressed,
                  ]}
                >
                  <ButtonLoadingContent
                    loaderColor={theme.colors.foreground}
                    loading={isSubmittingEntry}
                    loader={
                      <GuidedFinishLoader
                        active={isSubmittingEntry}
                        color={theme.colors.foreground}
                      />
                    }
                  >
                    <Text
                      style={[
                        styles.secondaryButtonText,
                        { color: theme.colors.foreground },
                      ]}
                    >
                      {finishActionLabel}
                    </Text>
                  </ButtonLoadingContent>
                </HapticPressable>
                {isSummaryFailed ||
                (canContinueDeeper && !hasReachedDeeperLimit) ? (
                  <HapticPressable
                    accessibilityLabel={
                      primaryButtonLabel === 'Suggest'
                        ? 'Open writing suggestions'
                        : primaryButtonLabel
                    }
                    accessibilityRole="button"
                    disabled={
                      !canUsePrimary ||
                      mode === 'deeper_loading' ||
                      isThreadLoading ||
                      isSubmittingEntry
                    }
                    onPress={handlePrimaryPress}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      {
                        backgroundColor:
                          canUsePrimary &&
                          mode !== 'deeper_loading' &&
                          !isThreadLoading
                            ? theme.colors.primary
                            : theme.colors.muted,
                        opacity:
                          canUsePrimary &&
                          mode !== 'deeper_loading' &&
                          !isThreadLoading
                            ? 1
                            : 0.62,
                      },
                      pressed &&
                        canUsePrimary &&
                        mode !== 'deeper_loading' &&
                        !isThreadLoading &&
                        !isSubmittingEntry &&
                        styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.primaryButtonText,
                        {
                          color: canUsePrimary
                            ? theme.colors.primaryForeground
                            : theme.colors.mutedForeground,
                        },
                      ]}
                    >
                      {primaryButtonLabel}
                    </Text>
                  </HapticPressable>
                ) : null}
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      )}
      </KeyboardAvoidingView>
    </>
  );

  const formatSignalPercent = (value: number) =>
    `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

  const handleSessionCardTextComplete = (cardNumber: number) => {
    setCompletedSessionTextCards(current =>
      current.includes(cardNumber) ? current : [...current, cardNumber],
    );

    if (cardNumber === SESSION_ANALYSIS_CARD_COUNT) {
      setVisibleCenterBreakdownRows(3);
      if (sessionCardSequenceTimerRef.current) {
        clearTimeout(sessionCardSequenceTimerRef.current);
      }
      sessionCardSequenceTimerRef.current = setTimeout(() => {
        setVisibleSessionTailStage(1);
        sessionCardSequenceTimerRef.current = null;
      }, SESSION_ANALYSIS_CARD_GAP_MS);
      return;
    }

    if (sessionCardSequenceTimerRef.current) {
      clearTimeout(sessionCardSequenceTimerRef.current);
    }

    sessionCardSequenceTimerRef.current = setTimeout(() => {
      setVisibleSessionCardCount(current => Math.max(current, cardNumber + 1));
      sessionCardSequenceTimerRef.current = null;
    }, SESSION_ANALYSIS_CARD_GAP_MS);
  };

  const handleMindMapBuildTextComplete = () => {
    if (sessionCardSequenceTimerRef.current) {
      clearTimeout(sessionCardSequenceTimerRef.current);
    }

    sessionCardSequenceTimerRef.current = setTimeout(() => {
      setVisibleSessionTailStage(2);
      sessionCardSequenceTimerRef.current = null;
    }, SESSION_ANALYSIS_CARD_GAP_MS);
  };

  const toggleCenterBreakdown = () => {
    LayoutAnimation.configureNext({
      duration: 240,
      create: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
    setIsCenterBreakdownExpanded(current => !current);
    triggerHaptic('secondaryAction').catch(() => undefined);
  };

  const renderCenterEvidenceChips = (evidence: string[]) => {
    const chips = evidence.slice(0, 3);

    if (!chips.length) {
      return null;
    }

    return (
      <View style={styles.centerEvidenceRow}>
        {chips.map(item => (
          <View
            key={item}
            style={[
              styles.centerEvidenceChip,
              {
                backgroundColor: hexToRgba(
                  theme.colors.primary,
                  theme.mode === 'dark' ? 0.18 : 0.1,
                ),
                borderColor: hexToRgba(theme.colors.primary, 0.18),
              },
            ]}
          >
            <Text
              style={[
                styles.centerEvidenceText,
                { color: theme.colors.foreground },
              ]}
            >
              {item}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderCenterBreakdownRow = (
    center: BrainCenterScore,
    brainSessionMap: BrainSessionMap,
  ) => {
    const isDominant = center.id === brainSessionMap.dominantCenterId;
    const isSecondary = brainSessionMap.secondaryCenterIds.includes(center.id);
    const barColor = isDominant
      ? theme.colors.primary
      : isSecondary
      ? hexToRgba(theme.colors.primary, 0.58)
      : hexToRgba(theme.colors.mutedForeground, 0.36);

    return (
      <View
        key={center.id}
        style={[
          styles.centerBreakdownRow,
          {
            backgroundColor: isDominant
              ? hexToRgba(
                  theme.colors.primary,
                  theme.mode === 'dark' ? 0.18 : 0.09,
                )
              : isSecondary
              ? hexToRgba(
                  theme.colors.secondary,
                  theme.mode === 'dark' ? 0.72 : 0.86,
                )
              : 'transparent',
            borderColor: isDominant
              ? hexToRgba(theme.colors.primary, 0.32)
              : hexToRgba(theme.colors.border, 0.7),
          },
        ]}
      >
        <View style={styles.centerBreakdownHeader}>
          <View style={styles.centerBreakdownTitleWrap}>
            <Text
              numberOfLines={1}
              style={[
                styles.centerBreakdownName,
                { color: theme.colors.foreground },
              ]}
            >
              {center.productName}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.centerBreakdownRegion,
                { color: theme.colors.mutedForeground },
              ]}
            >
              {center.brainRegion}
            </Text>
          </View>
          <Text
            style={[
              styles.centerBreakdownPercent,
              {
                color: isDominant
                  ? theme.colors.primary
                  : theme.colors.mutedForeground,
              },
            ]}
          >
            {formatSignalPercent(center.score)}
          </Text>
        </View>
        <View
          style={[
            styles.centerBarTrack,
            {
              backgroundColor: hexToRgba(
                theme.colors.border,
                theme.mode === 'dark' ? 0.5 : 0.76,
              ),
            },
          ]}
        >
          <View
            style={[
              styles.centerBarFill,
              {
                backgroundColor: barColor,
                width: `${Math.max(6, Math.round(center.score * 100))}%`,
              },
            ]}
          />
        </View>
      </View>
    );
  };

  const renderSessionAnalysisMode = () => {
    const brainSessionMap =
      sessionAnalysis?.brainSessionMap || buildFallbackBrainSessionMap(answers);
    const dominantCenter = brainSessionMap.dominantCenter;
    const sessionAnalysisText =
      sessionAnalysis?.analysis ||
      'Your entry is saved. As you keep writing, Journal.IO will help you notice patterns in your thoughts, mood, and habits.';
    const majorInsight =
      sessionAnalysis?.majorInsight ||
      'Major insight: there is not enough clear detail yet to identify a reliable pattern.';
    const visibleCenters = isCenterBreakdownExpanded
      ? brainSessionMap.centers
      : brainSessionMap.centers.slice(0, visibleCenterBreakdownRows);
    const hasAdditionalCenters = brainSessionMap.centers.length > 3;
    const isFirstCardTextComplete = completedSessionTextCards.includes(1);
    const isSecondCardTextComplete = completedSessionTextCards.includes(2);
    const detectedTopics = (
      sessionAnalysis?.detectedTopics ||
      sessionAnalysis?.topicsObserved ||
      []
    ).slice(0, 5);
    // Only an explicit `false` is a low-signal session — a missing flag means
    // the analysis predates the field, not that the entry was thin.
    const hasEnoughSignal = sessionAnalysis?.hasEnoughSignal !== false;

    return (
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.sessionContent,
          { maxWidth: contentMaxWidth },
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.sessionScroll}
      >
        {visibleSessionCardCount >= 1 ? (
          <Text
            style={[
              styles.sessionAnalysisTitle,
              { color: theme.colors.foreground },
            ]}
          >
            Session analysis
          </Text>
        ) : null}
        {visibleSessionCardCount >= 1 ? (
          <Animated.View
            style={[
              styles.analysisCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: hexToRgba(theme.colors.primary, 0.18),
                opacity: sessionCardRevealValues[0],
                transform: [
                  {
                    translateY: sessionCardRevealValues[0].interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text
              style={[styles.insightEyebrow, { color: theme.colors.primary }]}
            >
              {hasEnoughSignal ? 'SESSION ANALYSIS' : 'NOT ENOUGH DETAIL YET'}
            </Text>
            <Text
              style={[styles.insightTitle, { color: theme.colors.foreground }]}
            >
              {hasEnoughSignal
                ? 'A quick read on today'
                : 'Not enough to read from yet'}
            </Text>
            <TypewriterText
              active={activeSessionTextCard === 1}
              onComplete={() => handleSessionCardTextComplete(1)}
              style={[
                styles.insightBody,
                { color: theme.colors.mutedForeground },
              ]}
              text={sessionAnalysisText}
            />
            {isFirstCardTextComplete ? (
              <Text
                style={[
                  styles.majorInsightText,
                  { color: theme.colors.foreground },
                ]}
              >
                {majorInsight}
              </Text>
            ) : null}
          </Animated.View>
        ) : null}
        {visibleSessionCardCount >= 2 ? (
          <Animated.View
            style={[
              styles.analysisCard,
              styles.centerFeatureCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: hexToRgba(theme.colors.primary, 0.26),
                opacity: sessionCardRevealValues[1],
                transform: [
                  {
                    translateY: sessionCardRevealValues[1].interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.centerFeatureHeader}>
              <View style={styles.centerFeatureCopy}>
                <Text
                  style={[
                    styles.insightEyebrow,
                    { color: theme.colors.primary },
                  ]}
                >
                  MOST NOTICED CENTER
                </Text>
                <Text
                  style={[
                    styles.insightTitle,
                    { color: theme.colors.foreground },
                  ]}
                >
                  {dominantCenter.productName}
                </Text>
                <Text
                  style={[
                    styles.centerRegionText,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  {dominantCenter.brainRegion}
                </Text>
              </View>
              <View
                style={[
                  styles.centerSignalPill,
                  {
                    backgroundColor: hexToRgba(
                      theme.colors.primary,
                      theme.mode === 'dark' ? 0.2 : 0.11,
                    ),
                    borderColor: hexToRgba(theme.colors.primary, 0.24),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.centerSignalText,
                    { color: theme.colors.primary },
                  ]}
                >
                  {formatSignalPercent(dominantCenter.score)} signal
                </Text>
              </View>
            </View>
            <TypewriterText
              active={activeSessionTextCard === 2}
              onComplete={() => handleSessionCardTextComplete(2)}
              style={[
                styles.insightBody,
                { color: theme.colors.mutedForeground },
              ]}
              text={
                dominantCenter.shortInsight || brainSessionMap.mostNoticedText
              }
            />
            {isSecondCardTextComplete ? (
              <>
                <View style={styles.centerMetricRow}>
                  <Text
                    style={[
                      styles.centerMetricText,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    {formatSignalPercent(dominantCenter.confidence)} confidence
                  </Text>
                  <Text
                    style={[
                      styles.centerMetricText,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    {dominantCenter.intensity} intensity
                  </Text>
                </View>
                {renderCenterEvidenceChips(dominantCenter.evidence)}
              </>
            ) : null}
          </Animated.View>
        ) : null}
        {visibleSessionCardCount >= 3 ? (
          <Animated.View
            style={[
              styles.analysisCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: hexToRgba(theme.colors.border, 0.84),
                opacity: sessionCardRevealValues[2],
                transform: [
                  {
                    translateY: sessionCardRevealValues[2].interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text
              style={[styles.insightEyebrow, { color: theme.colors.primary }]}
            >
              CENTER BREAKDOWN
            </Text>
            <Text
              style={[styles.insightTitle, { color: theme.colors.foreground }]}
            >
              Your reflection map
            </Text>
            <TypewriterText
              active={activeSessionTextCard === 3}
              onComplete={() => handleSessionCardTextComplete(3)}
              style={[
                styles.centerBreakdownIntro,
                { color: theme.colors.mutedForeground },
              ]}
              text="The strongest signals are shown first."
            />
            <View style={styles.centerBreakdownCollapsedWrap}>
              <View style={styles.centerBreakdownList}>
                {visibleCenters.map(center =>
                  renderCenterBreakdownRow(center, brainSessionMap),
                )}
              </View>
              {!isCenterBreakdownExpanded &&
              visibleCenterBreakdownRows >= 3 &&
              hasAdditionalCenters ? (
                <View pointerEvents="none" style={styles.centerBreakdownFade}>
                  <Svg height="58" width="100%">
                    <Defs>
                      <LinearGradient
                        id="center-breakdown-fade"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <Stop
                          offset="0"
                          stopColor={theme.colors.card}
                          stopOpacity={0}
                        />
                        <Stop
                          offset="1"
                          stopColor={theme.colors.card}
                          stopOpacity={0.98}
                        />
                      </LinearGradient>
                    </Defs>
                    <Rect
                      fill="url(#center-breakdown-fade)"
                      height="58"
                      width="100%"
                    />
                  </Svg>
                </View>
              ) : null}
            </View>
            {visibleCenterBreakdownRows >= 3 && hasAdditionalCenters ? (
              <HapticPressable
                accessibilityLabel={
                  isCenterBreakdownExpanded ? 'Show less' : 'Show more'
                }
                accessibilityRole="button"
                onPress={toggleCenterBreakdown}
                style={({ pressed }) => [
                  styles.centerBreakdownTextButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.centerBreakdownToggleText,
                    { color: theme.colors.primary },
                  ]}
                >
                  {isCenterBreakdownExpanded ? 'Show less' : 'Show more'}
                </Text>
              </HapticPressable>
            ) : null}
          </Animated.View>
        ) : null}
        {visibleSessionTailStage >= 1 ? (
          <Animated.View
            style={[
              styles.analysisCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: hexToRgba(theme.colors.border, 0.84),
                opacity: sessionTailRevealValues[0],
                transform: [
                  {
                    translateY: sessionTailRevealValues[0].interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text
              style={[styles.insightEyebrow, { color: theme.colors.primary }]}
            >
              TOPICS DETECTED
            </Text>
            {detectedTopics.length === 0 ? (
              <Text
                style={[
                  styles.topicEmptyText,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                No clear topics stood out in this entry yet.
              </Text>
            ) : (
              <View style={styles.tagRow}>
                {detectedTopics.map(topic => (
                  <View
                    key={topic}
                    style={[
                      styles.topicChip,
                      {
                        backgroundColor: theme.colors.secondary,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.topicChipText,
                        { color: theme.colors.foreground },
                      ]}
                    >
                      {formatTopicLabel(topic)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        ) : null}
        {visibleSessionTailStage >= 1 ? (
          <Animated.View
            style={[
              styles.mindMapBuildCopy,
              {
                opacity: sessionTailRevealValues[0],
                transform: [
                  {
                    translateY: sessionTailRevealValues[0].interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text
              style={[
                styles.mindMapBuildTitle,
                { color: theme.colors.foreground },
              ]}
            >
              Your Mind Map is slowly building.
            </Text>
            <TypewriterText
              active={visibleSessionTailStage === 1}
              onComplete={handleMindMapBuildTextComplete}
              style={[
                styles.mindMapBuildSubtitle,
                { color: theme.colors.mutedForeground },
              ]}
              text="Each reflection adds a new signal to your brain-inspired reflection map."
            />
          </Animated.View>
        ) : null}
        {visibleSessionTailStage >= 2 ? (
          <Animated.View
            style={{
              opacity: sessionTailRevealValues[1],
              transform: [
                {
                  translateY: sessionTailRevealValues[1].interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            }}
          >
            <HapticPressable
              accessibilityLabel={
                isLoadingGoals ? 'Preparing goals' : 'Continue to goals'
              }
              accessibilityRole="button"
              accessibilityState={{ busy: isLoadingGoals }}
              disabled={isLoadingGoals}
              onPress={() => loadGoalSuggestions().catch(() => undefined)}
              style={({ pressed }) => [
                styles.savedPrimaryButton,
                { backgroundColor: theme.colors.primary },
                pressed && !isLoadingGoals && styles.pressed,
              ]}
            >
              <ButtonLoadingContent
                loaderColor={theme.colors.primaryForeground}
                loading={isLoadingGoals}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    {
                      color: theme.colors.primaryForeground,
                    },
                  ]}
                >
                  Continue
                </Text>
              </ButtonLoadingContent>
            </HapticPressable>
          </Animated.View>
        ) : null}
      </ScrollView>
    );
  };

  const renderGoalCard = (
    goal: FirstReflectionGoalSuggestion,
    index: number,
  ) => {
    if (index >= visibleGoalCardCount) {
      return null;
    }

    const cardReveal = goalCardRevealValues[index];
    const selectionReveal = goalSelectionValues[index];

    return (
      <Animated.View
        key={goal.id}
        style={{
          opacity: cardReveal,
          transform: [
            {
              translateY: cardReveal.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        }}
      >
        <View
          style={[
            styles.goalCard,
            {
              backgroundColor: goal.selected
                ? hexToRgba(
                    theme.colors.primary,
                    theme.mode === 'dark' ? 0.18 : 0.09,
                  )
                : theme.colors.card,
              borderColor: goal.selected
                ? hexToRgba(theme.colors.primary, 0.34)
                : hexToRgba(theme.colors.border, 0.86),
            },
          ]}
        >
          <HapticPressable
            accessibilityLabel={`${goal.selected ? 'Remove' : 'Add'} goal ${
              goal.title
            }`}
            accessibilityRole="button"
            onPress={() => toggleGoalSelection(goal.id)}
            style={styles.goalMainPressable}
          >
            <View style={styles.goalHeaderRow}>
              <View style={styles.goalTitleWrap}>
                <Text
                  numberOfLines={2}
                  style={[styles.goalTitle, { color: theme.colors.foreground }]}
                >
                  {goal.title}
                </Text>
                <View style={styles.goalMetaRow}>
                  <Text
                    style={[
                      styles.goalMetaText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    {GOAL_FREQUENCY_LABELS[goal.frequency]}
                  </Text>
                  <Text
                    style={[
                      styles.goalMetaDot,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    /
                  </Text>
                  <Text
                    style={[
                      styles.goalMetaText,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    {GOAL_CATEGORY_LABELS[goal.category]}
                  </Text>
                </View>
              </View>
              <Animated.View
                style={[
                  styles.goalSelectPill,
                  {
                    backgroundColor: goal.selected
                      ? theme.colors.primary
                      : theme.colors.secondary,
                    borderColor: goal.selected
                      ? theme.colors.primary
                      : theme.colors.border,
                    transform: [
                      {
                        scale: selectionReveal.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.9, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Animated.View style={{ opacity: selectionReveal }}>
                  <Check
                    color={theme.colors.primaryForeground}
                    size={14}
                    strokeWidth={2.4}
                  />
                </Animated.View>
              </Animated.View>
            </View>
            <View
              style={[
                styles.goalDivider,
                {
                  backgroundColor: hexToRgba(theme.colors.border, 0.82),
                },
              ]}
            />
            <Text
              numberOfLines={3}
              style={[
                styles.goalDescription,
                { color: theme.colors.mutedForeground },
              ]}
            >
              {goal.description}
            </Text>
          </HapticPressable>
          <View
            style={[
              styles.goalDivider,
              styles.goalContentDivider,
              {
                backgroundColor: hexToRgba(theme.colors.border, 0.82),
              },
            ]}
          />
          <HapticPressable
            accessibilityLabel={`Edit goal ${goal.title}`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => openGoalEditor(goal)}
            style={({ pressed }) => [
              styles.goalEditButton,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[styles.goalEditText, { color: theme.colors.primary }]}
            >
              Edit
            </Text>
          </HapticPressable>
        </View>
      </Animated.View>
    );
  };

  const renderGoalsMode = () => (
    <ScrollView
      bounces={false}
      contentContainerStyle={[
        styles.goalsContent,
        { maxWidth: contentMaxWidth },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.goalsScroll}
    >
      <View style={styles.valueScreen}>
        <Text
          style={[styles.metadata, { color: theme.colors.mutedForeground }]}
        >
          STARTER GOALS
        </Text>
        <Text style={[styles.screenTitle, { color: theme.colors.foreground }]}>
          A few goals to start with
        </Text>
        <Text
          style={[styles.screenBody, { color: theme.colors.mutedForeground }]}
        >
          Based on your first reflection, Journal.IO suggested small goals you
          can edit or keep.
        </Text>
        {goalsError ? (
          <Text style={[styles.errorText, { color: theme.colors.destructive }]}>
            {goalsError}
          </Text>
        ) : null}
        <View style={styles.goalList}>
          {goalSuggestions.map(renderGoalCard)}
        </View>
        <Animated.View
          style={{
            opacity: goalCtaReveal,
            transform: [
              {
                scale: goalCtaReveal,
              },
            ],
          }}
        >
          <HapticPressable
            accessibilityLabel={
              selectedGoalCount ? 'Add selected goals' : 'Skip goals for now'
            }
            accessibilityRole="button"
            accessibilityState={{ busy: isSavingGoals }}
            disabled={isSavingGoals}
            onPress={() => continueFromGoals().catch(() => undefined)}
            style={({ pressed }) => [
              styles.savedPrimaryButton,
              {
                backgroundColor: selectedGoalCount
                  ? theme.colors.primary
                  : theme.colors.secondary,
              },
              pressed && !isSavingGoals && styles.pressed,
            ]}
          >
            <ButtonLoadingContent
              loaderColor={
                selectedGoalCount
                  ? theme.colors.primaryForeground
                  : theme.colors.foreground
              }
              loading={isSavingGoals}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  {
                    color: selectedGoalCount
                      ? theme.colors.primaryForeground
                      : theme.colors.foreground,
                  },
                ]}
              >
                {selectedGoalCount ? 'Add selected goals' : 'Skip for now'}
              </Text>
            </ButtonLoadingContent>
          </HapticPressable>
        </Animated.View>
      </View>
    </ScrollView>
  );

  const renderStreakStartedMode = () => (
    <View style={[styles.streakShell, { maxWidth: contentMaxWidth }]}>
      <View style={styles.streakContent}>
        <View style={styles.streakHero}>
          <View style={styles.streakIconStage}>
            <View pointerEvents="none" style={styles.streakConfettiLayer}>
              {STREAK_CONFETTI.map((piece, index) => {
                const confettiValue = streakConfettiValues[index];
                const color = [
                  theme.colors.primary,
                  theme.colors.accent,
                  theme.colors.foreground,
                ][index % 3];

                return (
                  <Animated.View
                    key={`${piece.x}-${piece.y}`}
                    style={[
                      styles.streakConfettiPiece,
                      {
                        backgroundColor: color,
                        opacity: confettiValue.interpolate({
                          inputRange: [0, 0.12, 0.78, 1],
                          outputRange: [0, 1, 1, 0],
                        }),
                        transform: [
                          {
                            translateX: confettiValue.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, piece.x],
                            }),
                          },
                          {
                            translateY: confettiValue.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, piece.y],
                            }),
                          },
                          {
                            rotate: confettiValue.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', piece.rotation],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                );
              })}
            </View>
            <Animated.View
              style={[
                styles.streakFlameWrap,
                {
                  backgroundColor: hexToRgba(theme.colors.primary, 0.08),
                  opacity: streakFlameReveal,
                  transform: [
                    {
                      scale: streakFlameReveal.interpolate({
                        inputRange: [0, 0.72, 1],
                        outputRange: [0.82, 1.06, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Animated.Image
                accessibilityIgnoresInvertColors
                accessibilityLabel="A warm flame marking the start of your journaling rhythm"
                resizeMode="contain"
                source={onboardingStreakFireIcon}
                style={[
                  styles.streakFlame,
                  {
                    transform: [
                      {
                        rotate: streakFlameTilt.interpolate({
                          inputRange: [0, 1, 2, 3, 4],
                          outputRange: [
                            '0deg',
                            '-8deg',
                            '7deg',
                            '-5deg',
                            '0deg',
                          ],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </Animated.View>
          </View>
          <Animated.View
            style={{
              opacity: streakTextReveal,
              transform: [
                {
                  translateY: streakTextReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            }}
          >
            <Text
              style={[styles.streakTitle, { color: theme.colors.foreground }]}
            >
              A steady start.
            </Text>
            <Text
              style={[
                styles.streakCopy,
                { color: theme.colors.mutedForeground },
              ]}
            >
              One reflection is enough to begin.
            </Text>
          </Animated.View>
        </View>
      </View>
      <Animated.View
        pointerEvents={isStreakCtaVisible ? 'auto' : 'none'}
        style={{
          opacity: streakCtaReveal,
          transform: [
            {
              translateY: streakCtaReveal.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
            {
              scale: streakCtaReveal.interpolate({
                inputRange: [0, 1],
                outputRange: [0.965, 1],
              }),
            },
          ],
        }}
      >
        <HapticPressable
          accessibilityLabel="Let's go!"
          accessibilityRole="button"
          onPress={continueFromStreak}
          style={({ pressed }) => [
            styles.savedPrimaryButton,
            styles.streakContinueButton,
            { backgroundColor: theme.colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.primaryButtonText,
              { color: theme.colors.primaryForeground },
            ]}
          >
            Let's go!
          </Text>
        </HapticPressable>
      </Animated.View>
    </View>
  );

  const completionButtonAnimatedStyle = {
    opacity: completionButtonReveal,
    transform: [
      {
        translateY: completionButtonReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
      {
        scale: completionButtonPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.02],
        }),
      },
    ],
  };

  const renderCompletionFeatures = () => (
    <View style={styles.completionFeatureList}>
      {READY_FEATURE_CARDS.map((feature, index) => {
        const revealValue = completionFeatureRevealValues[index];
        const isDark = theme.mode === 'dark';

        return (
          <Animated.View
            key={feature.text}
            style={[
              styles.completionFeatureCard,
              {
                backgroundColor: isDark
                  ? hexToRgba(theme.colors.secondary, 0.78)
                  : hexToRgba(theme.colors.card, 0.86),
                borderColor: hexToRgba(
                  theme.colors.primary,
                  isDark ? 0.24 : 0.16,
                ),
                opacity: revealValue,
                transform: [
                  {
                    translateY: revealValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                  {
                    scale: revealValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.completionFeatureIconWrap,
                {
                  backgroundColor: hexToRgba(
                    theme.colors.primary,
                    isDark ? 0.18 : 0.1,
                  ),
                },
              ]}
            >
              <Image
                accessibilityIgnoresInvertColors
                resizeMode="contain"
                source={readyFeatureIcons[index]}
                style={styles.completionFeatureIcon}
              />
            </View>
            <Text
              style={[
                styles.completionFeatureText,
                { color: theme.colors.foreground },
              ]}
            >
              {feature.text}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );

  const renderSavedMode = () => (
    <View style={[styles.completionShell, { maxWidth: contentMaxWidth }]}>
      <View style={styles.completionCopy}>
        <View style={styles.completionHeaderGroup}>
          <Animated.Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="Celebration"
            resizeMode="contain"
            source={readyCelebrationIcon}
            style={[
              styles.completionIcon,
              {
                transform: [
                  {
                    rotate: completionIconShake.interpolate({
                      inputRange: [0, 1, 2, 3],
                      outputRange: ['0deg', '-8deg', '8deg', '0deg'],
                    }),
                  },
                  {
                    scale: completionIconShake.interpolate({
                      inputRange: [0, 1, 2, 3],
                      outputRange: [1, 1.05, 1.03, 1],
                    }),
                  },
                ],
              },
            ]}
          />
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.completionTitle, { color: theme.colors.foreground }]}
          >
            Your first entry is complete!
          </Text>
          <Text
            style={[
              styles.completionBody,
              { color: theme.colors.mutedForeground },
            ]}
          >
            Journal.IO is ready to grow with your reflections.
          </Text>
        </View>
        {renderCompletionFeatures()}
      </View>
      <View style={styles.completionFooter}>
        <Animated.View
          pointerEvents={isCompletionCtaEnabled ? 'auto' : 'none'}
          style={[styles.completionButtonWrap, completionButtonAnimatedStyle]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.completionButtonHalo,
              {
                backgroundColor: theme.colors.primary,
                opacity: completionButtonPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.08, 0.22],
                }),
                transform: [
                  {
                    scaleX: completionButtonPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.07],
                    }),
                  },
                  {
                    scaleY: completionButtonPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.3],
                    }),
                  },
                ],
              },
            ]}
          />
          <HapticPressable
            accessibilityLabel="Continue to Home"
            accessibilityRole="button"
            disabled={!isCompletionCtaEnabled}
            onPress={handleContinueAfterSave}
            style={({ pressed }) => [
              styles.completionPrimaryButton,
              { backgroundColor: theme.colors.primary },
              pressed && isCompletionCtaEnabled && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                { color: theme.colors.primaryForeground },
              ]}
            >
              Continue
            </Text>
          </HapticPressable>
        </Animated.View>
      </View>
      {saveError ? (
        <Text style={[styles.errorText, { color: theme.colors.destructive }]}>
          {saveError}
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <View
        pointerEvents="none"
        style={[
          styles.backgroundOrb,
          {
            backgroundColor: hexToRgba(
              theme.colors.primary,
              theme.mode === 'dark' ? 0.2 : 0.16,
            ),
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.backgroundOrbSecondary,
          {
            backgroundColor: hexToRgba(
              theme.colors.accent,
              theme.mode === 'dark' ? 0.22 : 0.72,
            ),
          },
        ]}
      />
      {mode === 'core_prompts' ||
      mode === 'ai_summary_loading' ||
      mode === 'optional_deeper' ||
      mode === 'deeper_loading'
        ? renderWritingMode()
        : mode === 'session_analysis'
        ? renderSessionAnalysisMode()
        : mode === 'goals'
        ? renderGoalsMode()
        : mode === 'streak_started'
        ? renderStreakStartedMode()
        : renderSavedMode()}

      <KeyboardDismissAccessory
        nativeID={FIRST_GUIDED_REFLECTION_KEYBOARD_ACCESSORY_ID}
        backgroundColor={theme.colors.card}
        borderColor={theme.colors.border}
        actionColor={theme.colors.primary}
      />

      <Modal
        animationType="none"
        onRequestClose={() => dismissSuggestionSheet()}
        transparent
        visible={isSuggestionSheetMounted}
      >
        <View style={styles.modalRoot}>
          <Animated.View
            style={[
              styles.modalScrim,
              { opacity: suggestionSheetScrimOpacity },
            ]}
          >
            <HapticPressable
              accessibilityLabel="Dismiss suggestions"
              style={StyleSheet.absoluteFill}
              onPress={() => dismissSuggestionSheet()}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                transform: [
                  {
                    translateY: suggestionSheetSlide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [340, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View
              style={[styles.grabber, { backgroundColor: theme.colors.border }]}
            />
            <Text
              style={[styles.sheetTitle, { color: theme.colors.foreground }]}
            >
              What would help right now?
            </Text>
            <Text
              style={[
                styles.sheetBody,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Choose what you want Journal.IO to respond to.
            </Text>
            {SUGGESTION_OPTIONS.map(option => (
              <HapticPressable
                accessibilityLabel={option.label}
                accessibilityRole="button"
                disabled={isSuggestionSelectionPending}
                key={option.actionType}
                onPress={() => handleSelectSuggestion(option)}
                style={({ pressed }) => [
                  styles.sheetOption,
                  {
                    backgroundColor: theme.colors.secondary,
                    borderColor: theme.colors.border,
                    opacity: isSuggestionSelectionPending ? 0.58 : 1,
                  },
                  pressed && !isSuggestionSelectionPending && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.sheetOptionText,
                    { color: theme.colors.foreground },
                  ]}
                >
                  {option.label}
                </Text>
              </HapticPressable>
            ))}
          </Animated.View>
        </View>
      </Modal>

      <ConfirmActionSheet
        body="You can save what you have now, or answer a few more prompts to make your first entry more complete."
        dismissAccessibilityLabel="Dismiss finish confirmation"
        onDismiss={() => setIsFinishConfirmVisible(false)}
        onPrimary={() => {
          setIsFinishConfirmVisible(false);
          triggerHaptic('secondaryAction').catch(() => undefined);
        }}
        onSecondary={handleConfirmFinish}
        primaryLabel="Keep writing"
        secondaryLabel="Finish session"
        title="Finish this reflection?"
        visible={isFinishConfirmVisible}
      />

      <GoalSheet
        goal={editingGoalAsSavedGoal}
        isSubmitting={false}
        mode="edit"
        onClose={closeGoalEditor}
        onSubmit={applyEditedGoal}
        unavailableIcons={unavailableGoalIcons}
        visible={isGoalEditorVisible && Boolean(editingGoalAsSavedGoal)}
      />

      <Modal
        animationType="none"
        onRequestClose={() => setIsLeaveConfirmVisible(false)}
        transparent
        visible={isLeaveConfirmMounted}
      >
        <View style={styles.modalRoot}>
          <Animated.View
            style={[styles.modalScrim, { opacity: leaveSheetScrimOpacity }]}
          >
            <HapticPressable
              accessibilityLabel="Dismiss exit confirmation"
              style={StyleSheet.absoluteFill}
              onPress={() => setIsLeaveConfirmVisible(false)}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                transform: [
                  {
                    translateY: leaveSheetSlide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [340, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View
              style={[styles.grabber, { backgroundColor: theme.colors.border }]}
            />
            <Text
              style={[styles.sheetTitle, { color: theme.colors.foreground }]}
            >
              Are you sure?
            </Text>
            <Text
              style={[
                styles.sheetBody,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Every entry matters. Staying with this moment can bring you one
              step closer to understanding yourself, but you can always return
              when it feels right.
            </Text>
            <HapticPressable
              accessibilityLabel="Exit guided reflection"
              accessibilityRole="button"
              onPress={() => {
                leaveAfterSheetCloseRef.current = true;
                setIsLeaveConfirmVisible(false);
                triggerHaptic('secondaryAction').catch(() => undefined);
              }}
              style={({ pressed }) => [
                styles.sheetSecondaryButton,
                {
                  backgroundColor: theme.colors.secondary,
                  borderColor: theme.colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: theme.colors.foreground },
                ]}
              >
                Exit
              </Text>
            </HapticPressable>
            <HapticPressable
              accessibilityLabel="Cancel exit"
              accessibilityRole="button"
              onPress={() => {
                setIsLeaveConfirmVisible(false);
                triggerHaptic('primaryAction').catch(() => undefined);
              }}
              style={({ pressed }) => [
                styles.sheetPrimaryButton,
                { backgroundColor: theme.colors.primary },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: theme.colors.primaryForeground },
                ]}
              >
                Cancel
              </Text>
            </HapticPressable>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  activePrompt: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.65,
    lineHeight: 36,
  },
  activePromptWrap: {
    marginTop: 18,
    paddingBottom: 18,
  },
  followUpPrompt: {
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  answerText: {
    fontSize: 18,
    lineHeight: 28,
    marginTop: 12,
  },
  analysisCard: {
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
    width: '100%',
  },
  centerBarFill: {
    borderRadius: 999,
    height: '100%',
  },
  centerBarTrack: {
    borderRadius: 999,
    height: 6,
    marginTop: 9,
    overflow: 'hidden',
    width: '100%',
  },
  assistantIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  backgroundOrb: {
    borderRadius: 160,
    height: 320,
    position: 'absolute',
    right: -120,
    top: -130,
    width: 320,
  },
  backgroundOrbSecondary: {
    borderRadius: 160,
    bottom: 90,
    height: 280,
    left: -140,
    position: 'absolute',
    width: 280,
  },
  bodyInput: {
    borderRadius: 24,
    borderWidth: 1,
    fontSize: 17,
    lineHeight: 27,
    minHeight: 270,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  bottomSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    marginTop: 'auto',
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  centerBody: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 340,
    textAlign: 'center',
  },
  centerBreakdownHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  centerBreakdownCollapsedWrap: {
    position: 'relative',
  },
  centerBreakdownFade: {
    bottom: 0,
    height: 58,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  centerBreakdownIntro: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  centerBreakdownList: {
    gap: 9,
    marginTop: 16,
  },
  centerBreakdownName: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
    lineHeight: 17,
  },
  centerBreakdownPercent: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  centerBreakdownRegion: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 2,
  },
  centerBreakdownRow: {
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  centerBreakdownTitleWrap: {
    flex: 1,
  },
  centerBreakdownTextButton: {
    alignSelf: 'center',
    marginTop: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  centerBreakdownToggleText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  centerEvidenceChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  centerEvidenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 14,
  },
  centerEvidenceText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.05,
  },
  centerFeatureCard: {
    paddingTop: 17,
  },
  centerFeatureCopy: {
    flex: 1,
    paddingRight: 10,
  },
  centerFeatureHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  centerIcon: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: 18,
    width: 56,
  },
  centerShimmerWrap: {
    maxWidth: 360,
    width: '100%',
  },
  centerMetricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 13,
  },
  centerMetricText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    textTransform: 'capitalize',
  },
  centerRegionText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 4,
  },
  centerSignalPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  centerSignalText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.05,
  },
  centerState: {
    alignItems: 'center',
    alignSelf: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  centerTitle: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.7,
    lineHeight: 36,
    textAlign: 'center',
  },
  coreActionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  corePager: {
    flex: 1,
    width: '100%',
  },
  coreProgressDot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  coreProgressDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  coreProgressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  coreProgressText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 18,
  },
  corePromptHelper: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  corePromptInput: {
    fontSize: 17,
    lineHeight: 25,
    maxHeight: 176,
    minHeight: 112,
    paddingHorizontal: 2,
    paddingVertical: 12,
  },
  corePromptInputWrap: {
    marginTop: 24,
    position: 'relative',
  },
  corePromptPage: {
    flex: 1,
  },
  corePromptPageContent: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingBottom: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  corePromptTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.65,
    lineHeight: 34,
  },
  coreReflectionShell: {
    alignSelf: 'center',
    flex: 1,
    width: '100%',
  },
  optionalInlineInput: {
    fontSize: 17,
    lineHeight: 25,
    marginTop: 14,
    maxHeight: 144,
    minHeight: 72,
    paddingHorizontal: 2,
    paddingVertical: 8,
  },
  reflectionActionReveal: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  completionBody: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    maxWidth: 320,
    textAlign: 'center',
  },
  completionButtonHalo: {
    borderRadius: 24,
    height: 66,
    maxWidth: 280,
    position: 'absolute',
    top: -8,
    width: '76%',
  },
  completionButtonWrap: {
    alignItems: 'center',
    width: '100%',
  },
  completionCopy: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 8,
    width: '100%',
  },
  completionFeatureCard: {
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  completionFeatureIcon: {
    height: 25,
    width: 25,
  },
  completionFeatureIconWrap: {
    alignItems: 'center',
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  completionFeatureList: {
    gap: 9,
    marginTop: 12,
    width: '100%',
  },
  completionFeatureText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  completionFooter: {
    alignItems: 'center',
    paddingBottom: 4,
    paddingTop: 8,
    width: '100%',
  },
  completionHeaderGroup: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  completionIcon: {
    height: 62,
    marginBottom: 2,
    width: 62,
  },
  completionPrimaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    maxWidth: 280,
    minHeight: 50,
    shadowColor: '#8E4636',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    width: '76%',
  },
  completionShell: {
    alignSelf: 'center',
    flex: 1,
    paddingHorizontal: 18,
    width: '100%',
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.45,
    lineHeight: 30,
    maxWidth: 350,
    textAlign: 'center',
  },
  entryBlock: {
    marginTop: 24,
  },
  errorCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  errorCardText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 14,
    textAlign: 'center',
  },
  grabber: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 4,
    marginBottom: 18,
    width: 42,
  },
  explanationCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  explanationCardBody: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  explanationCardList: {
    gap: 10,
    marginTop: 22,
    width: '100%',
  },
  explanationCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.15,
    lineHeight: 22,
  },
  explanationIcon: {
    alignItems: 'center',
    borderRadius: 22,
    height: 48,
    justifyContent: 'center',
    marginBottom: 20,
    width: 48,
  },
  goalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
  },
  goalDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 0,
  },
  goalContentDivider: {
    marginBottom: 2,
    marginTop: 10,
  },
  goalDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 10,
    marginTop: 10,
    width: '100%',
  },
  goalEditButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: 32,
  },
  goalEditText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  goalHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  goalList: {
    gap: 8,
    marginTop: 18,
    width: '100%',
  },
  goalsContent: {
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 28,
    paddingTop: 24,
    width: '100%',
  },
  goalsScroll: {
    flex: 1,
    width: '100%',
  },
  goalMainPressable: {
    width: '100%',
  },
  goalMetaDot: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  goalMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 3,
  },
  goalMetaText: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  goalSelectPill: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  goalTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.15,
    lineHeight: 20,
  },
  goalTitleWrap: {
    flex: 1,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  iconButtonSpacer: {
    height: 38,
    width: 38,
  },
  insightBody: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  insightCard: {
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 24,
    padding: 18,
    width: '100%',
  },
  insightEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 10,
  },
  inlineRetryButton: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 40,
    paddingHorizontal: 18,
  },
  keyboardRoot: {
    flex: 1,
  },
  majorInsightText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 14,
  },
  mindMapBuildCopy: {
    alignItems: 'flex-start',
    marginTop: 24,
    width: '100%',
  },
  mindMapBuildSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    marginTop: 8,
  },
  mindMapBuildTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 25,
  },
  metadata: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.35,
    marginBottom: 18,
  },
  modalRoot: {
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.36)',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1.15,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  promptText: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 28,
  },
  reflectionCard: {
    alignItems: 'flex-start',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    padding: 16,
  },
  reflectionCardBody: {
    flex: 1,
  },
  reflectionCardEyebrow: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  reflectionCardTakeaway: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 10,
  },
  reflectionCardText: {
    fontSize: 15,
    lineHeight: 22,
  },
  reviewActions: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  reviewContent: {
    alignSelf: 'center',
    flexGrow: 1,
    paddingBottom: 24,
    paddingHorizontal: 2,
    paddingTop: 18,
    width: '100%',
  },
  reviewPrimaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  reviewSecondaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  savedPrimaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 26,
    minHeight: 52,
    paddingHorizontal: 42,
  },
  screenBody: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
  },
  screenTitle: {
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.55,
    lineHeight: 31,
  },
  streakCopy: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  streakContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  streakConfettiLayer: {
    height: 190,
    left: '50%',
    marginLeft: -120,
    marginTop: -95,
    position: 'absolute',
    top: '50%',
    width: 240,
  },
  streakConfettiPiece: {
    borderRadius: 2,
    height: 8,
    left: '50%',
    marginLeft: -3,
    marginTop: -4,
    position: 'absolute',
    top: '58%',
    width: 6,
  },
  streakContinueButton: {
    marginTop: 0,
  },
  streakFlame: {
    height: 76,
    width: 76,
  },
  streakFlameWrap: {
    alignItems: 'center',
    borderRadius: 48,
    height: 96,
    justifyContent: 'center',
    marginBottom: 20,
    width: 96,
  },
  streakHero: {
    alignItems: 'center',
    maxWidth: 320,
    paddingHorizontal: 20,
    width: '100%',
  },
  streakIconStage: {
    alignItems: 'center',
    height: 124,
    justifyContent: 'center',
    marginBottom: 18,
    position: 'relative',
    width: '100%',
  },
  streakShell: {
    alignSelf: 'center',
    flex: 1,
    paddingBottom: 28,
    paddingTop: 24,
    width: '100%',
  },
  streakTitle: {
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.55,
    lineHeight: 31,
    textAlign: 'center',
  },
  scrollContent: {
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: 112,
    paddingHorizontal: 2,
    paddingTop: 8,
    width: '100%',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 10,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  sheetBody: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
    textAlign: 'center',
  },
  sheetOption: {
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 9,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  sheetOptionText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  sheetPrimaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 52,
  },
  sheetSecondaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 52,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 28,
    marginBottom: 8,
    textAlign: 'center',
  },
  shimmerIcon: {
    borderRadius: 13,
    height: 28,
    width: 28,
  },
  skeletonEyebrow: {
    borderRadius: 999,
    height: 9,
    marginBottom: 14,
    width: 82,
  },
  skeletonLine: {
    borderRadius: 999,
    height: 11,
    marginTop: 9,
    width: '100%',
  },
  skeletonLineShort: {
    width: '62%',
  },
  sessionContent: {
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    width: '100%',
  },
  sessionAnalysisTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.55,
    lineHeight: 34,
    marginTop: 20,
    width: '100%',
  },
  sessionScroll: {
    flex: 1,
    width: '100%',
  },
  supportiveNote: {
    alignItems: 'flex-start',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 28,
    padding: 16,
  },
  supportiveNoteText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  topicEmptyText: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  threadUserLine: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
    maxWidth: '94%',
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  topicChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topicChipText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.05,
  },
  threadUserRequestText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 2,
  },
  threadQuestionText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.15,
    lineHeight: 21,
  },
  threadUserText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.55,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  transcriptTransition: {
    flex: 1,
  },
  titleInput: {
    borderBottomWidth: 1,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.65,
    lineHeight: 34,
    marginBottom: 16,
    marginTop: 30,
    paddingBottom: 12,
  },
  valueHelper: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 10,
  },
  valueScreen: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  topBarWordmark: {
    width: 190,
  },
});
