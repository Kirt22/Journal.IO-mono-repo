import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FirstGuidedReflectionScreen, {
  type FirstReflectionAnalysisPayload,
  type FirstReflectionGoalsPayload,
  type FirstReflectionStreakPayload,
} from '../src/screens/onboarding/FirstGuidedReflectionScreen';
import type {
  BrainCenterScore,
  BrainReflectionCenterId,
  BrainSessionMap,
} from '../src/services/guidedReflectionService';
import * as guidedReflectionService from '../src/services/guidedReflectionService';
import * as hapticsService from '../src/services/hapticsService';
import type { GoalDraft } from '../src/services/goalsService';
import { ThemeProvider } from '../src/theme/provider';

jest.mock('../src/services/hapticsService', () => ({
  stopHaptics: jest.fn(async () => undefined),
  triggerHaptic: jest.fn(async () => undefined),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

const centerIds: BrainReflectionCenterId[] = [
  'planning_self_control',
  'emotional_intensity',
  'memory_meaning',
  'body_inner_signals',
  'conflict_attention',
  'motivation_reward',
  'relationships_perspective',
  'self_reflection_identity',
];

const buildCenter = (
  id: BrainReflectionCenterId,
  index: number,
): BrainCenterScore => ({
  id,
  productName: `Center ${index + 1}`,
  brainRegion: `Region ${index + 1}`,
  score: 0.9 - index * 0.08,
  confidence: 0.8 - index * 0.05,
  rank: index + 1,
  intensity: index === 0 ? 'high' : 'moderate',
  evidence: index === 0 ? ['kept one task small'] : [],
  shortInsight: `Center ${
    index + 1
  } appeared in the reflection through a concise signal.`,
  nuancedDetails: {},
});

const centers = centerIds.map(buildCenter);
const brainSessionMap: BrainSessionMap = {
  dominantCenterId: centers[0].id,
  dominantCenter: centers[0],
  secondaryCenterIds: [centers[1].id, centers[2].id],
  secondaryCenters: [centers[1], centers[2]],
  centers,
  neuroscienceSummary: 'A concise hidden summary.',
  mostNoticedText: 'Center 1 was the strongest signal.',
  mindMapSeedText: 'The first reflection added a Mind Map signal.',
};

const analysisPayload: FirstReflectionAnalysisPayload = {
  answers: {
    good_exciting: 'I made focused time for a walk.',
    hurdle: 'A deadline felt close.',
    carry_tomorrow: 'Keep one task small.',
  },
  aiSummary: null,
  draft: { version: 2 },
  sessionAnalysis: {
    analysis:
      'The reflection suggests that focused time helped create steadiness while the deadline added pressure. Keeping one task small may make tomorrow feel more manageable.',
    majorInsight:
      'Major insight: calm progress may be more useful than urgency.',
    observedTrends: ['Focus', 'Pressure'],
    topicsObserved: ['Focus', 'Pressure'],
    detectedTopics: ['focus', 'stress'],
    detectedMood: 'okay',
    brainSessionMap,
    hasEnoughSignal: true,
  },
  threadMessages: [],
};

function extractText(node: unknown): string {
  if (node == null) {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }

  if (typeof node === 'object' && 'children' in node) {
    return extractText((node as { children?: unknown }).children);
  }

  return '';
}

const renderScreen = (
  initialAnalysisPayload?: FirstReflectionAnalysisPayload,
  initialGoalsPayload?: FirstReflectionGoalsPayload,
  initialStreakPayload?: FirstReflectionStreakPayload,
  onGoalsSaved?: (goalDrafts: GoalDraft[]) => Promise<void>,
  onGoalsReady?: (payload: FirstReflectionGoalsPayload) => void,
) =>
  ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <ThemeProvider modeOverride="light">
        <FirstGuidedReflectionScreen
          draft={{ version: 2 }}
          initialAnalysisPayload={initialAnalysisPayload}
          initialGoalsPayload={initialGoalsPayload}
          initialStreakPayload={initialStreakPayload}
          onBackToReady={jest.fn()}
          onAnalysisReady={jest.fn()}
          onGoalsReady={onGoalsReady}
          onGoalsSaved={onGoalsSaved}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

const flushTimers = () => {
  for (let index = 0; index < 120; index += 1) {
    ReactTestRenderer.act(() => {
      jest.runOnlyPendingTimers();
    });
  }
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('uses the compact Journal.IO wordmark banner in the reflection top bar', () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  expect(
    root.root.findByProps({ accessibilityLabel: 'Journal.IO' }),
  ).toBeTruthy();
});

test('preserves the original session-analysis cards and adds detected topics', () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen(analysisPayload);
  });
  flushTimers();

  let text = extractText(root.toJSON());
  expect(text).toContain('SESSION ANALYSIS');
  expect(text).toContain('TOPICS DETECTED');
  expect(text).toContain('Focus');
  expect(text).toContain('Stress');
  expect(text).toContain('MOST NOTICED CENTER');
  expect(text).toContain('CENTER BREAKDOWN');
  expect(text).toContain('Your Mind Map is slowly building.');
  expect(text).toContain(
    'The reflection suggests that focused time helped create steadiness',
  );
  expect(text).toContain(
    'Center 1 appeared in the reflection through a concise signal.',
  );
  expect(text).not.toContain('Your first reflection is saved.');
  expect(text).not.toContain('PATTERNS OBSERVED');
  expect(text).not.toContain('NEUROSCIENCE ANGLE');
  expect(text).toContain('Center 3');
  expect(text).not.toContain('Center 4');

  ReactTestRenderer.act(() => {
    root.root.findByProps({ accessibilityLabel: 'Show more' }).props.onPress();
  });

  text = extractText(root.toJSON());
  expect(text).toContain('Center 8');
  expect(
    root.root.findByProps({ accessibilityLabel: 'Show less' }),
  ).toBeTruthy();
});

test('offers no exit until there is something to finish, and no repeated eyebrow', () => {
  let root!: ReactTestRenderer.ReactTestRenderer;
  const onBack = jest.fn();

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ThemeProvider modeOverride="light">
          <FirstGuidedReflectionScreen
            draft={{ version: 2 }}
            onBackToReady={onBack}
          />
        </ThemeProvider>
      </SafeAreaProvider>,
    );
  });

  expect(extractText(root.toJSON())).not.toContain('YOUR REFLECTION');
  // An empty composer used to show an "Exit" action, which invited the user
  // out of onboarding before they had written anything.
  expect(root.root.findAllByProps({ accessibilityLabel: 'Exit' })).toHaveLength(
    0,
  );

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({
        accessibilityLabel:
          'Write your answer to: What was one good or exciting thing that happened today?',
      })
      .props.onChangeText('A good moment today was a calm walk.');
  });

  expect(
    root.root.findByProps({ accessibilityLabel: 'Finish entry' }),
  ).toBeTruthy();
  expect(root.root.findAllByProps({ accessibilityLabel: 'Exit' })).toHaveLength(
    0,
  );
});

test('puts the highlighted keep-writing action before finish session in the incomplete-entry sheet', () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({
        accessibilityLabel:
          'Write your answer to: What was one good or exciting thing that happened today?',
      })
      .props.onChangeText('A good moment today was a calm walk.');
  });
  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Finish entry' })
      .props.onPress();
  });
  flushTimers();

  const text = extractText(root.toJSON());
  expect(
    root.root.findByProps({ accessibilityLabel: 'Keep writing' }),
  ).toBeTruthy();
  expect(
    root.root.findByProps({ accessibilityLabel: 'Finish session' }),
  ).toBeTruthy();
  expect(text.indexOf('Keep writing')).toBeLessThan(
    text.indexOf('Finish session'),
  );
});

test('unlocks the next prompt while keeping the earlier answer editable', () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({
        accessibilityLabel:
          'Write your answer to: What was one good or exciting thing that happened today?',
      })
      .props.onChangeText('A calm walk made the afternoon feel lighter.');
  });
  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Next prompt' })
      .props.onPress();
  });
  flushTimers();

  const firstAnswer = root.root.findByProps({
    accessibilityLabel:
      'Write your answer to: What was one good or exciting thing that happened today?',
  });
  expect(firstAnswer.props.value).toBe(
    'A calm walk made the afternoon feel lighter.',
  );
  expect(
    root.root.findByProps({
      accessibilityLabel:
        'Write your answer to: What was one hurdle or stressful moment you faced today?',
    }),
  ).toBeTruthy();

  ReactTestRenderer.act(() => {
    firstAnswer.props.onChangeText(
      'A quiet walk made the afternoon feel lighter.',
    );
  });

  expect(firstAnswer.props.value).toBe(
    'A quiet walk made the afternoon feel lighter.',
  );
});

test('returns from an earlier pager page to the current prompt', () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  const firstAnswer = root.root.findByProps({
    accessibilityLabel:
      'Write your answer to: What was one good or exciting thing that happened today?',
  });

  ReactTestRenderer.act(() => {
    firstAnswer.props.onChangeText(
      'A calm walk made the afternoon feel lighter.',
    );
  });
  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Next prompt' })
      .props.onPress();
  });
  flushTimers();
  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ testID: 'guided-core-pager' })
      .props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: 0 } },
      });
  });

  expect(
    root.root.findByProps({ accessibilityLabel: 'Continue writing' }),
  ).toBeTruthy();

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Continue writing' })
      .props.onPress();
  });

  expect(
    root.root.findByProps({ accessibilityLabel: 'Next prompt' }),
  ).toBeTruthy();
});

test('keeps a revised earlier answer in the final guided-reflection payload', async () => {
  const summarySpy = jest
    .spyOn(guidedReflectionService, 'createFirstReflectionSummary')
    .mockResolvedValue({
      reflection: 'A short reflection is ready.',
      followUpQuestion: 'What felt hardest about that?',
    });
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({
        accessibilityLabel:
          'Write your answer to: What was one good or exciting thing that happened today?',
      })
      .props.onChangeText('A quiet walk felt good.');
  });
  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Next prompt' })
      .props.onPress();
  });
  flushTimers();

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({
        accessibilityLabel:
          'Write your answer to: What was one hurdle or stressful moment you faced today?',
      })
      .props.onChangeText('A rushed deadline felt difficult.');
    root.root
      .findByProps({
        accessibilityLabel:
          'Write your answer to: What was one good or exciting thing that happened today?',
      })
      .props.onChangeText('A slower walk felt even better.');
  });
  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Next prompt' })
      .props.onPress();
  });
  flushTimers();
  ReactTestRenderer.act(() => {
    root.root
      .findByProps({
        accessibilityLabel:
          'Write your answer to: What would you like to carry into tomorrow?',
      })
      .props.onChangeText('Keep one task small.');
  });
  ReactTestRenderer.act(() => {
    root.root.findByProps({ accessibilityLabel: 'Go deeper' }).props.onPress();
  });
  flushTimers();
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(summarySpy).toHaveBeenCalledWith(
    expect.objectContaining({
      promptAnswers: expect.arrayContaining([
        expect.objectContaining({ answer: 'A slower walk felt even better.' }),
      ]),
    }),
  );
  summarySpy.mockRestore();
});

test('keeps the reflection composer keyboard-safe', () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  const composer = root.root.findByProps({
    accessibilityLabel:
      'Write your answer to: What was one good or exciting thing that happened today?',
  });

  expect(composer.props.inputAccessoryViewID).toBe(
    'first-guided-reflection-keyboard-actions',
  );
});

test('restores core actions when writing ends or the keyboard is dismissed', () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  const input = root.root.findByProps({
    accessibilityLabel:
      'Write your answer to: What was one good or exciting thing that happened today?',
  });

  ReactTestRenderer.act(() => {
    input.props.onFocus();
  });
  expect(
    root.root.findByProps({ testID: 'guided-core-actions' }).props
      .pointerEvents,
  ).toBe('none');

  ReactTestRenderer.act(() => {
    input.props.onEndEditing();
  });
  expect(
    root.root.findByProps({ testID: 'guided-core-actions' }).props
      .pointerEvents,
  ).toBe('auto');

  ReactTestRenderer.act(() => {
    input.props.onFocus();
    input.props.onBlur();
  });
  expect(
    root.root.findByProps({ testID: 'guided-core-actions' }).props
      .pointerEvents,
  ).toBe('auto');

  expect(
    root.root.findByProps({ testID: 'guided-core-pager' }).props
      .keyboardShouldPersistTaps,
  ).toBe('never');
  expect(
    root.root.findAllByProps({ keyboardShouldPersistTaps: 'never' }).length,
  ).toBeGreaterThanOrEqual(2);
});

test('uses an unboxed optional response with focus-aware actions and a sliding suggestions sheet', async () => {
  const summarySpy = jest
    .spyOn(guidedReflectionService, 'createFirstReflectionSummary')
    .mockResolvedValue({
      reflection: 'A short reflection is ready.',
      followUpQuestion: 'What felt hardest about that?',
    });
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  const submitCoreAnswer = (
    accessibilityLabel: string,
    answer: string,
    actionLabel: string,
  ) => {
    ReactTestRenderer.act(() => {
      root.root.findByProps({ accessibilityLabel }).props.onChangeText(answer);
    });
    ReactTestRenderer.act(() => {
      root.root
        .findByProps({ accessibilityLabel: actionLabel })
        .props.onPress();
    });
    flushTimers();
  };

  submitCoreAnswer(
    'Write your answer to: What was one good or exciting thing that happened today?',
    'A calm walk helped.',
    'Next prompt',
  );
  submitCoreAnswer(
    'Write your answer to: What was one hurdle or stressful moment you faced today?',
    'A deadline felt close.',
    'Next prompt',
  );
  submitCoreAnswer(
    'Write your answer to: What would you like to carry into tomorrow?',
    'Start with one task.',
    'Go deeper',
  );
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });
  flushTimers();

  const optionalInput = root.root.findByProps({
    accessibilityLabel: 'Write your answer to: What felt hardest about that?',
  });
  const text = extractText(root.toJSON());
  expect(text).toContain('What felt hardest about that?');
  expect(text).not.toContain('Anything else you want to add?');
  expect(text).not.toContain(
    'Optional - add any detail that would make this reflection feel complete.',
  );
  expect(() =>
    root.root.findByProps({ testID: 'guided-reflection-composer' }),
  ).toThrow();

  ReactTestRenderer.act(() => {
    optionalInput.props.onFocus();
  });
  expect(
    root.root.findByProps({ testID: 'guided-reflection-actions' }).props
      .pointerEvents,
  ).toBe('none');
  ReactTestRenderer.act(() => {
    optionalInput.props.onEndEditing();
  });
  expect(
    root.root.findByProps({ testID: 'guided-reflection-actions' }).props
      .pointerEvents,
  ).toBe('auto');

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Open writing suggestions' })
      .props.onPress();
  });
  flushTimers();
  expect(
    root.root.findByProps({ accessibilityLabel: 'Dismiss suggestions' }),
  ).toBeTruthy();

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Dismiss suggestions' })
      .props.onPress();
  });
  flushTimers();
  expect(
    root.root.findAllByProps({ accessibilityLabel: 'Dismiss suggestions' }),
  ).toHaveLength(0);
  summarySpy.mockRestore();
});

test('keeps every core prompt visible after entering Go deeper', async () => {
  const summarySpy = jest
    .spyOn(guidedReflectionService, 'createFirstReflectionSummary')
    .mockResolvedValue({
      reflection: 'A short reflection is ready.',
      followUpQuestion: 'What felt hardest about that?',
    });
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  const submitAnswer = (
    accessibilityLabel: string,
    answer: string,
    actionLabel: string,
  ) => {
    ReactTestRenderer.act(() => {
      root.root.findByProps({ accessibilityLabel }).props.onChangeText(answer);
    });
    ReactTestRenderer.act(() => {
      root.root
        .findByProps({ accessibilityLabel: actionLabel })
        .props.onPress();
    });
    flushTimers();
  };

  submitAnswer(
    'Write your answer to: What was one good or exciting thing that happened today?',
    'I finished a small project.',
    'Next prompt',
  );
  submitAnswer(
    'Write your answer to: What was one hurdle or stressful moment you faced today?',
    'A last-minute request felt heavy.',
    'Next prompt',
  );
  submitAnswer(
    'Write your answer to: What would you like to carry into tomorrow?',
    'Start with the most important task.',
    'Go deeper',
  );

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });
  flushTimers();

  const text = extractText(root.toJSON());
  expect(text).toContain(
    'What was one good or exciting thing that happened today?',
  );
  expect(text).toContain('I finished a small project.');
  expect(text).toContain(
    'What was one hurdle or stressful moment you faced today?',
  );
  expect(text).toContain('A last-minute request felt heavy.');
  expect(text).toContain('What would you like to carry into tomorrow?');
  expect(text).toContain('Start with the most important task.');
  expect(summarySpy).toHaveBeenCalledWith(
    expect.objectContaining({
      promptAnswers: expect.arrayContaining([
        expect.objectContaining({ answer: 'I finished a small project.' }),
        expect.objectContaining({
          answer: 'A last-minute request felt heavy.',
        }),
        expect.objectContaining({
          answer: 'Start with the most important task.',
        }),
      ]),
    }),
  );
  summarySpy.mockRestore();
});

test('reveals unselected starter goals and updates the action after selection', () => {
  const goalsPayload: FirstReflectionGoalsPayload = {
    ...analysisPayload,
    goalSuggestions: [
      {
        title: 'Take a 5-minute walk',
        description:
          'After lunch tomorrow, take a five-minute walk before opening your next task.',
        frequency: 'daily',
        category: 'focus',
        icon: 'focus',
      },
      {
        title: 'Name the deadline pressure',
        description:
          'Before bed, write one sentence naming what the deadline is asking from you tomorrow.',
        frequency: 'as_needed',
        category: 'stress',
        icon: 'anxiety',
      },
    ],
  };
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen(undefined, goalsPayload);
  });
  flushTimers();

  let text = extractText(root.toJSON());
  expect(text).toContain('Take a 5-minute walk');
  expect(text).toContain('Name the deadline pressure');
  expect(text).toContain('Skip for now');
  expect(
    root.root.findByProps({
      accessibilityLabel: 'Add goal Take a 5-minute walk',
    }),
  ).toBeTruthy();
  expect(text).not.toContain('Keep only what feels useful');
  expect(text).not.toContain('We used a simple starter set');

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Add goal Take a 5-minute walk' })
      .props.onPress();
  });

  text = extractText(root.toJSON());
  expect(text).toContain('Add selected goals');
});

test('keeps the saved journal ID when analysis advances to guided goals', async () => {
  const onGoalsReady = jest.fn();
  const goalSuggestionsSpy = jest
    .spyOn(guidedReflectionService, 'createGuidedReflectionGoalSuggestions')
    .mockResolvedValue({
      goals: [
        {
          title: 'Start with one task',
          description: 'Choose one bounded task before opening other work.',
          frequency: 'daily',
          category: 'focus',
          icon: 'focus',
        },
      ],
      hasEnoughSignal: true,
    });
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen(
      { ...analysisPayload, journalId: 'guided-journal-1' },
      undefined,
      undefined,
      undefined,
      onGoalsReady,
    );
  });
  flushTimers();

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: 'Continue to goals' })
      .props.onPress();
    await Promise.resolve();
  });

  expect(onGoalsReady).toHaveBeenCalledWith(
    expect.objectContaining({
      journalId: 'guided-journal-1',
      sessionAnalysis: analysisPayload.sessionAnalysis,
    }),
  );
  goalSuggestionsSpy.mockRestore();
});

test('persists only selected guided goals before leaving the flow', async () => {
  const goalsPayload: FirstReflectionGoalsPayload = {
    ...analysisPayload,
    goalSuggestions: [
      {
        title: 'Take a 5-minute walk',
        description:
          'After lunch tomorrow, take a five-minute walk before opening your next task.',
        frequency: 'daily',
        category: 'focus',
        icon: 'focus',
      },
      {
        title: 'Name the deadline pressure',
        description:
          'Before bed, write one sentence naming what the deadline is asking from you tomorrow.',
        frequency: 'as_needed',
        category: 'stress',
        icon: 'anxiety',
      },
    ],
  };
  const onGoalsSaved = jest.fn(async () => undefined);
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen(undefined, goalsPayload, undefined, onGoalsSaved);
  });
  flushTimers();

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Add goal Take a 5-minute walk' })
      .props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: 'Add selected goals' })
      .props.onPress();
    await Promise.resolve();
  });

  // The AI's description / frequency / icon now survive the save instead of
  // being thrown away in favour of a bare title.
  expect(onGoalsSaved).toHaveBeenCalledWith([
    expect.objectContaining({
      title: 'Take a 5-minute walk',
      frequency: 'daily',
      icon: 'focus',
    }),
  ]);
});

test('shows the compact streak start without redundant day-count copy', () => {
  const streakPayload: FirstReflectionStreakPayload = {
    ...analysisPayload,
    goalSuggestions: [
      {
        id: 'take-a-walk-0',
        title: 'Take a 5-minute walk',
        description:
          'After lunch tomorrow, take a five-minute walk before opening your next task.',
        frequency: 'daily',
        category: 'focus',
        icon: 'focus',
        selected: true,
        source: 'ai',
        iconSource: 'automatic',
        reminderEnabled: false,
        reminderTime: null,
      },
    ],
  };
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen(undefined, undefined, streakPayload);
  });
  flushTimers();

  const text = extractText(root.toJSON());
  expect(text).toContain('A steady start.');
  expect(text).toContain('One reflection is enough to begin.');
  expect(text).not.toContain('You showed up today.');
  expect(text).not.toContain('1-day streak');
  expect(
    root.root.findByProps({ accessibilityLabel: "Let's go!" }),
  ).toBeTruthy();
  expect(
    root.root.findByProps({
      accessibilityLabel:
        'A warm flame marking the start of your journaling rhythm',
    }),
  ).toBeTruthy();
  expect(hapticsService.triggerHaptic).toHaveBeenCalledWith('streakFlame');
  expect(hapticsService.stopHaptics).toHaveBeenCalled();
});
