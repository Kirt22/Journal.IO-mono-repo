/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import InsightsScreen from "../src/screens/InsightsScreen";
import {
  getInsightsAiAnalysis,
  getInsightsOverview,
} from "../src/services/insightsService";
import { resetAppStore, useAppStore } from "../src/store/appStore";

jest.mock("../src/services/insightsService", () => ({
  getInsightsOverview: jest.fn(async () => ({
    stats: {
      totalEntries: 14,
      currentStreak: 4,
      averageWords: 91,
      totalFavorites: 3,
    },
    activity7d: [
      { dateKey: "2026-03-26", label: "Thu", count: 1 },
      { dateKey: "2026-03-27", label: "Fri", count: 0 },
      { dateKey: "2026-03-28", label: "Sat", count: 2 },
      { dateKey: "2026-03-29", label: "Sun", count: 1 },
      { dateKey: "2026-03-30", label: "Mon", count: 4 },
      { dateKey: "2026-03-31", label: "Tue", count: 3 },
      { dateKey: "2026-04-01", label: "Wed", count: 2 },
    ],
    moodDistribution: [
      { mood: "amazing", label: "Amazing", count: 2, percentage: 18 },
      { mood: "good", label: "Good", count: 4, percentage: 34 },
      { mood: "okay", label: "Okay", count: 3, percentage: 28 },
      { mood: "bad", label: "Bad", count: 1, percentage: 12 },
      { mood: "terrible", label: "Terrible", count: 1, percentage: 8 },
    ],
    popularTopics: [
      { tag: "morning-routines", label: "Morning Routines", count: 8, percentage: 32 },
      { tag: "work-stress", label: "Work Stress", count: 6, percentage: 24 },
      { tag: "relationships", label: "Relationships", count: 5, percentage: 18 },
      { tag: "sleep-energy", label: "Sleep Energy", count: 4, percentage: 14 },
      { tag: "gratitude", label: "Gratitude", count: 3, percentage: 12 },
    ],
    analysis: {
      summary: "overview-placeholder",
      keyInsight: "overview-placeholder",
      growthPatterns: [],
      personalizedPrompts: [],
    },
    updatedAt: "2026-04-01T09:00:00.000Z",
  })),
  getInsightsAiAnalysis: jest.fn(async () => ({
    window: {
      startDate: "2026-03-26",
      endDate: "2026-04-01",
      label: "Mar 26 - Apr 1",
      entryCount: 6,
      activeDays: 5,
      totalWords: 842,
    },
    freshness: {
      generatedAt: "2026-04-01T09:05:00.000Z",
      confidence: "high",
      confidenceLabel: "Clearer weekly pattern",
      note: "This view is based on a fuller week of journaling language and mood check-ins.",
    },
    summary: {
      headline: "Conscientiousness stood out most this week",
      narrative:
        "Looking at the last week of writing, journal language suggests conscientiousness may be the clearest pattern right now, while self-focus signal is the main area to keep gentle watch on.",
      highlight:
        "Morning Routines appears repeatedly across the week and may be a useful theme for your next few reflections.",
    },
    patternTags: [
      { label: "Morning Routines", tone: "coral" },
      { label: "Routine Seeking", tone: "amber" },
      { label: "Connection Energy", tone: "sage" },
    ],
    bigFive: [
      {
        trait: "conscientiousness",
        label: "Conscientiousness",
        score: 74,
        band: "pronounced",
        description:
          "Your writing rhythm appears structured this week, supported by a 4-day streak.",
        evidenceTags: ["4-day streak", "Routine"],
      },
      {
        trait: "openness",
        label: "Openness",
        score: 63,
        band: "steady",
        description:
          "Your writing suggests a balanced openness this week, with room for both novelty and familiar anchors.",
        evidenceTags: ["Morning Routines", "New perspectives"],
      },
      {
        trait: "extraversion",
        label: "Extraversion",
        score: 58,
        band: "steady",
        description:
          "Your writing shows a balanced social orientation, with attention to both connection and personal space.",
        evidenceTags: ["Connection", "Good"],
      },
      {
        trait: "agreeableness",
        label: "Agreeableness",
        score: 61,
        band: "steady",
        description:
          "Your entries suggest a balanced tone between caring for others and staying clear about your own needs.",
        evidenceTags: ["Care", "Relationships"],
      },
      {
        trait: "neuroticism",
        label: "Emotional Sensitivity",
        score: 41,
        band: "emerging",
        description:
          "Your writing suggests a steadier emotional tone this week, with fewer signs of strain dominating the page.",
        evidenceTags: ["Good", "Stress cues"],
      },
    ],
    darkTriad: [
      {
        trait: "narcissism",
        label: "Narcissism",
        supportiveLabel: "Self-focus signal",
        score: 31,
        band: "low",
        description:
          "Very little in the recent writing points toward image-protection or approval-seeking dominating the week.",
        supportTip:
          "Balance one self-focused reflection with one note about shared effort or support you received.",
      },
      {
        trait: "machiavellianism",
        label: "Machiavellianism",
        supportiveLabel: "Control-seeking signal",
        score: 42,
        band: "watch",
        description:
          "There are mild signs of control-seeking or strategic guarding in the week. That can be a normal response to pressure.",
        supportTip:
          "When planning next steps, add one sentence about flexibility or what you can let unfold naturally.",
      },
      {
        trait: "psychopathy",
        label: "Psychopathy",
        supportiveLabel: "Emotional detachment signal",
        score: 18,
        band: "low",
        description:
          "Recent entries show very little language associated with detachment or emotional bluntness.",
        supportTip:
          "If you notice yourself going numb, try naming one feeling and one body sensation before the next entry ends.",
      },
    ],
    actionPlan: {
      headline:
        "Focus on steadier routines, clearer emotional naming, and one recurring theme this week.",
      steps: [
        {
          title: "Keep one signal you can repeat",
          description:
            "Pick one part of your current journaling rhythm that already feels steady and repeat it for the next three days.",
          focus: "Consistency",
        },
        {
          title: "Protect the streak without raising the bar",
          description:
            "You already have momentum with a 4-day streak. Keep it going with short but honest entries rather than waiting for a perfect moment.",
          focus: "Momentum",
        },
        {
          title: "Use Morning Routines as a reflection thread",
          description:
            "Revisit the same theme across a few entries and notice whether the tone, triggers, or needs underneath it start to shift.",
          focus: "Morning Routines",
        },
      ],
    },
    appSupport: {
      headline: "Journal.IO can help turn these patterns into gentler habits over time.",
      items: [
        {
          title: "Daily mood check-ins add emotional context",
          description:
            "Keeping the mood tracker active helps confirm whether good is staying steady or shifting across the week.",
        },
        {
          title: "Tags make recurring topics easier to spot",
          description:
            "Tagging entries consistently helps the app notice when themes like morning routines keep returning.",
        },
        {
          title: "Short prompts can sharpen the next entry",
          description:
            "When a pattern starts to repeat, a focused prompt can help you move from description into clearer self-observation and action.",
        },
      ],
    },
  })),
}));

const safeAreaMetrics = {
  frame: {
    x: 0,
    y: 0,
    width: 390,
    height: 844,
  },
  insets: {
    top: 47,
    bottom: 34,
    left: 0,
    right: 0,
  },
};

function extractText(node: unknown): string {
  if (node == null) {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(child => extractText(child)).join("");
  }

  if (typeof node === "object" && "children" in node) {
    return extractText((node as { children?: unknown }).children);
  }

  return "";
}

async function waitForText(
  renderer: ReactTestRenderer.ReactTestRenderer,
  expectedText: string
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (extractText(renderer.toJSON()).includes(expectedText)) {
      return;
    }

    await ReactTestRenderer.act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
}

const setPremiumSession = (isPremium: boolean, aiOptIn = true) => {
  useAppStore.setState({
    session: {
      accessToken: "test-access",
      refreshToken: "test-refresh",
      user: {
        userId: "user-test",
        name: "Journal User",
        phoneNumber: null,
        email: "journal@example.com",
        isPremium,
        journalingGoals: [],
        avatarColor: null,
        profileSetupCompleted: true,
        onboardingCompleted: true,
        profilePic: null,
        aiOptIn,
      },
    },
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("renders the insights screen from API data and switches tabs", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <InsightsScreen />
      </SafeAreaProvider>
    );

    await Promise.resolve();
    await Promise.resolve();
  });

  const overviewTree = extractText(root!.toJSON());

  expect(getInsightsOverview).toHaveBeenCalledTimes(1);
  expect(overviewTree).toContain("Insights");
  expect(overviewTree).toContain("Your journaling patterns & growth");
  expect(overviewTree).toContain("Overview");
  expect(overviewTree).toContain("AI Analysis");
  expect(overviewTree).toContain("Total Entries");
  expect(overviewTree).toContain("14");
  expect(overviewTree).toContain("Current Streak");
  expect(overviewTree).toContain("4 days");
  expect(overviewTree).toContain("7-Day Activity");
  expect(overviewTree).toContain("Mood Distribution");
  expect(overviewTree).toContain("Amazing");
  expect(overviewTree).toContain("Good");
  expect(overviewTree).toContain("Popular Topics");
  expect(overviewTree).toContain("Morning Routines");
  expect(overviewTree).toContain("Work Stress");
  expect(getInsightsAiAnalysis).toHaveBeenCalledTimes(0);

  await ReactTestRenderer.act(async () => {
    root!.root.findByProps({ testID: "activity-point-0" }).props.onPress();
  });

  const updatedOverviewTree = extractText(root!.toJSON());
  expect(updatedOverviewTree).toContain("Thu");
  expect(updatedOverviewTree).toContain("1 journaling sessions");

  await ReactTestRenderer.act(async () => {
    root!.root.findByProps({ testID: "breakdown-segment-1" }).props.onPress();
  });

  const updatedMoodTree = extractText(root!.toJSON());
  expect(updatedMoodTree).toContain("34%");
  expect(updatedMoodTree).toContain("Good");

  await ReactTestRenderer.act(async () => {
    root!.root.findByProps({ accessibilityLabel: "AI Analysis" }).props.onPress();
  });

  await waitForText(root!, "Weekly Analysis");

  const analysisTree = extractText(root!.toJSON());
  expect(getInsightsAiAnalysis).toHaveBeenCalledTimes(1);
  expect(analysisTree).toContain("Weekly Analysis");
  expect(analysisTree).toContain("Conscientiousness stood out most this week");
  expect(analysisTree).toContain("Big Five Signals");
  expect(analysisTree).toContain("Conscientiousness");
  expect(analysisTree).toContain("Self-Protection Watchpoints");
  expect(analysisTree).toContain("Narcissism");
  expect(analysisTree).toContain("Actionable Steps");
  expect(analysisTree).toContain("Protect the streak without raising the bar");
  expect(analysisTree).toContain("How Journal.IO Helps");
  expect(analysisTree).toContain("Tags make recurring topics easier to spot");
});

test("shows a locked AI analysis state for non-premium users", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(false);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <InsightsScreen />
      </SafeAreaProvider>
    );

    await Promise.resolve();
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    root!.root.findByProps({ accessibilityLabel: "AI Analysis" }).props.onPress();
  });

  const tree = extractText(root!.toJSON());

  expect(getInsightsOverview).toHaveBeenCalledTimes(1);
  expect(getInsightsAiAnalysis).toHaveBeenCalledTimes(0);
  expect(tree).toContain("AI Analysis is a premium feature");
  expect(tree).toContain("Open Subscription");

  ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityLabel: "Open subscription" }).props.onPress();
  });

  expect(useAppStore.getState().activeTab).toBe("profile");
});

test("shows an AI opt-out state without fetching the analysis", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true, false);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <InsightsScreen />
      </SafeAreaProvider>
    );

    await Promise.resolve();
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    root!.root.findByProps({ accessibilityLabel: "AI Analysis" }).props.onPress();
  });

  const tree = extractText(root!.toJSON());

  expect(getInsightsOverview).toHaveBeenCalledTimes(1);
  expect(getInsightsAiAnalysis).toHaveBeenCalledTimes(0);
  expect(tree).toContain("AI analysis is turned off");
  expect(tree).toContain("You chose not to use Journal.IO's AI reflections");
});
