import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import FirstGuidedReflectionScreen, {
  type FirstReflectionAnalysisPayload,
  type FirstReflectionGoalsPayload,
  type FirstReflectionStreakPayload,
} from "../src/screens/onboarding/FirstGuidedReflectionScreen";
import type {
  BrainCenterScore,
  BrainReflectionCenterId,
  BrainSessionMap,
} from "../src/services/guidedReflectionService";
import * as guidedReflectionService from "../src/services/guidedReflectionService";
import { ThemeProvider } from "../src/theme/provider";

jest.mock("../src/services/hapticsService", () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

const centerIds: BrainReflectionCenterId[] = [
  "planning_self_control",
  "emotional_intensity",
  "memory_meaning",
  "body_inner_signals",
  "conflict_attention",
  "motivation_reward",
  "relationships_perspective",
  "self_reflection_identity",
];

const buildCenter = (id: BrainReflectionCenterId, index: number): BrainCenterScore => ({
  id,
  productName: `Center ${index + 1}`,
  brainRegion: `Region ${index + 1}`,
  score: 0.9 - index * 0.08,
  confidence: 0.8 - index * 0.05,
  rank: index + 1,
  intensity: index === 0 ? "high" : "moderate",
  evidence: index === 0 ? ["kept one task small"] : [],
  shortInsight: `Center ${index + 1} appeared in the reflection through a concise signal.`,
  nuancedDetails: {},
});

const centers = centerIds.map(buildCenter);
const brainSessionMap: BrainSessionMap = {
  dominantCenterId: centers[0].id,
  dominantCenter: centers[0],
  secondaryCenterIds: [centers[1].id, centers[2].id],
  secondaryCenters: [centers[1], centers[2]],
  centers,
  neuroscienceSummary: "A concise hidden summary.",
  mostNoticedText: "Center 1 was the strongest signal.",
  mindMapSeedText: "The first reflection added a Mind Map signal.",
};

const analysisPayload: FirstReflectionAnalysisPayload = {
  answers: {
    good_exciting: "I made focused time for a walk.",
    hurdle: "A deadline felt close.",
    carry_tomorrow: "Keep one task small.",
  },
  aiSummary: null,
  draft: { version: 2 },
  sessionAnalysis: {
    analysis:
      "The reflection suggests that focused time helped create steadiness while the deadline added pressure. Keeping one task small may make tomorrow feel more manageable.",
    majorInsight: "Major insight: calm progress may be more useful than urgency.",
    observedTrends: ["Focus", "Pressure"],
    topicsObserved: ["Focus", "Pressure"],
    brainSessionMap,
    hasEnoughSignal: true,
  },
  threadMessages: [],
};

function extractText(node: unknown): string {
  if (node == null) {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }

  if (typeof node === "object" && "children" in node) {
    return extractText((node as { children?: unknown }).children);
  }

  return "";
}

const renderScreen = (
  initialAnalysisPayload?: FirstReflectionAnalysisPayload,
  initialGoalsPayload?: FirstReflectionGoalsPayload,
  initialStreakPayload?: FirstReflectionStreakPayload,
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
        />
      </ThemeProvider>
    </SafeAreaProvider>
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

test("uses the compact Journal.IO wordmark banner in the reflection top bar", () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  expect(root.root.findByProps({ accessibilityLabel: "Journal.IO" })).toBeTruthy();
});

test("shows the compact session-analysis cards and expands all center rows", () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen(analysisPayload);
  });
  flushTimers();

  let text = extractText(root.toJSON());
  expect(text).toContain("SESSION ANALYSIS");
  expect(text).toContain("MOST NOTICED CENTER");
  expect(text).toContain("CENTER BREAKDOWN");
  expect(text).toContain("The reflection suggests that focused time helped create steadiness");
  expect(text).toContain("Center 1 appeared in the reflection through a concise signal.");
  expect(text).not.toContain("Your first reflection is saved.");
  expect(text).not.toContain("PATTERNS OBSERVED");
  expect(text).not.toContain("NEUROSCIENCE ANGLE");
  expect(text).toContain("Center 3");
  expect(text).not.toContain("Center 4");

  ReactTestRenderer.act(() => {
    root.root.findByProps({ accessibilityLabel: "Show more" }).props.onPress();
  });

  text = extractText(root.toJSON());
  expect(text).toContain("Center 8");
  expect(root.root.findByProps({ accessibilityLabel: "Show less" })).toBeTruthy();
});

test("puts the highlighted keep-writing action before finish session in the incomplete-entry sheet", () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({
        accessibilityLabel: "Write your answer to: What was one good or exciting thing that happened today?",
      })
      .props.onChangeText("A good moment today was a calm walk.");
  });
  ReactTestRenderer.act(() => {
    root.root.findByProps({ accessibilityLabel: "Finish entry" }).props.onPress();
  });
  flushTimers();

  const text = extractText(root.toJSON());
  expect(root.root.findByProps({ accessibilityLabel: "Keep writing" })).toBeTruthy();
  expect(root.root.findByProps({ accessibilityLabel: "Finish session" })).toBeTruthy();
  expect(text.indexOf("Keep writing")).toBeLessThan(text.indexOf("Finish session"));
});

test("settles a core answer before advancing to the next prompt", () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({
        accessibilityLabel: "Write your answer to: What was one good or exciting thing that happened today?",
      })
      .props.onChangeText("A calm walk made the afternoon feel lighter.");
  });
  ReactTestRenderer.act(() => {
    root.root.findByProps({ accessibilityLabel: "Next prompt" }).props.onPress();
  });
  flushTimers();

  const text = extractText(root.toJSON());
  expect(text).toContain("A calm walk made the afternoon feel lighter.");
  expect(
    root.root.findByProps({
      accessibilityLabel: "Write your answer to: What was one hurdle or stressful moment you faced today?",
    })
  ).toBeTruthy();
});

test("keeps earlier answers visible while the next core answer is being submitted", () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({
        accessibilityLabel: "Write your answer to: What was one good or exciting thing that happened today?",
      })
      .props.onChangeText("A quiet walk felt good.");
  });
  ReactTestRenderer.act(() => {
    root.root.findByProps({ accessibilityLabel: "Next prompt" }).props.onPress();
  });
  flushTimers();

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({
        accessibilityLabel: "Write your answer to: What was one hurdle or stressful moment you faced today?",
      })
      .props.onChangeText("A rushed deadline felt difficult.");
  });
  ReactTestRenderer.act(() => {
    root.root.findByProps({ accessibilityLabel: "Next prompt" }).props.onPress();
  });

  const firstAnswerStyle = StyleSheet.flatten(
    root.root.findByProps({ testID: "guided-answer-good_exciting" }).props.style,
  );

  expect(firstAnswerStyle.opacity).toBeUndefined();
  expect(extractText(root.toJSON())).toContain("A quiet walk felt good.");
});

test("keeps the reflection composer keyboard-safe", () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  const composer = root.root.findByProps({
    accessibilityLabel: "Write your answer to: What was one good or exciting thing that happened today?",
  });

  expect(composer.props.inputAccessoryViewID).toBe(
    "first-guided-reflection-keyboard-actions",
  );
});

test("keeps every core prompt visible after entering Go deeper", async () => {
  const summarySpy = jest
    .spyOn(guidedReflectionService, "createFirstReflectionSummary")
    .mockResolvedValue({ reflection: "A short reflection is ready." });
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen();
  });

  const submitAnswer = (accessibilityLabel: string, answer: string, actionLabel: string) => {
    ReactTestRenderer.act(() => {
      root.root.findByProps({ accessibilityLabel }).props.onChangeText(answer);
    });
    ReactTestRenderer.act(() => {
      root.root.findByProps({ accessibilityLabel: actionLabel }).props.onPress();
    });
    flushTimers();
  };

  submitAnswer(
    "Write your answer to: What was one good or exciting thing that happened today?",
    "I finished a small project.",
    "Next prompt"
  );
  submitAnswer(
    "Write your answer to: What was one hurdle or stressful moment you faced today?",
    "A last-minute request felt heavy.",
    "Next prompt"
  );
  submitAnswer(
    "Write your answer to: What would you like to carry into tomorrow?",
    "Start with the most important task.",
    "Go deeper"
  );

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });
  flushTimers();

  const text = extractText(root.toJSON());
  expect(text).toContain("What was one good or exciting thing that happened today?");
  expect(text).toContain("I finished a small project.");
  expect(text).toContain("What was one hurdle or stressful moment you faced today?");
  expect(text).toContain("A last-minute request felt heavy.");
  expect(text).toContain("What would you like to carry into tomorrow?");
  expect(text).toContain("Start with the most important task.");
  expect(summarySpy).toHaveBeenCalledWith(
    expect.objectContaining({
      promptAnswers: expect.arrayContaining([
        expect.objectContaining({ answer: "I finished a small project." }),
        expect.objectContaining({ answer: "A last-minute request felt heavy." }),
        expect.objectContaining({ answer: "Start with the most important task." }),
      ]),
    })
  );
  summarySpy.mockRestore();
});

test("reveals unselected starter goals and updates the action after selection", () => {
  const goalsPayload: FirstReflectionGoalsPayload = {
    ...analysisPayload,
    goalSuggestions: [
      {
        title: "Take a 5-minute walk",
        description: "After lunch tomorrow, take a five-minute walk before opening your next task.",
        frequency: "daily",
        category: "focus",
      },
      {
        title: "Name the deadline pressure",
        description: "Before bed, write one sentence naming what the deadline is asking from you tomorrow.",
        frequency: "as_needed",
        category: "stress",
      },
    ],
  };
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen(undefined, goalsPayload);
  });
  flushTimers();

  let text = extractText(root.toJSON());
  expect(text).toContain("Take a 5-minute walk");
  expect(text).toContain("Name the deadline pressure");
  expect(text).toContain("Skip for now");
  expect(root.root.findByProps({ accessibilityLabel: "Add goal Take a 5-minute walk" })).toBeTruthy();
  expect(text).not.toContain("Keep only what feels useful");
  expect(text).not.toContain("We used a simple starter set");

  ReactTestRenderer.act(() => {
    root.root.findByProps({ accessibilityLabel: "Add goal Take a 5-minute walk" }).props.onPress();
  });

  text = extractText(root.toJSON());
  expect(text).toContain("Add selected goals");
});

test("shows the compact streak start without redundant day-count copy", () => {
  const streakPayload: FirstReflectionStreakPayload = {
    ...analysisPayload,
    goalSuggestions: [
      {
        id: "take-a-walk-0",
        title: "Take a 5-minute walk",
        description: "After lunch tomorrow, take a five-minute walk before opening your next task.",
        frequency: "daily",
        category: "focus",
        selected: true,
        source: "ai",
      },
    ],
  };
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderScreen(undefined, undefined, streakPayload);
  });
  flushTimers();

  const text = extractText(root.toJSON());
  expect(text).toContain("A steady start.");
  expect(text).toContain("One reflection is enough to begin.");
  expect(text).not.toContain("You showed up today.");
  expect(text).not.toContain("1-day streak");
  expect(root.root.findByProps({ accessibilityLabel: "I am excited" })).toBeTruthy();
  expect(
    root.root.findByProps({
      accessibilityLabel: "A warm flame marking the start of your journaling rhythm",
    })
  ).toBeTruthy();
});
