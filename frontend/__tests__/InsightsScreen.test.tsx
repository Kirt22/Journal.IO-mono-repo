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

const readyAiAnalysis = {
  status: "ready" as const,
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
    confidence: "high" as const,
    confidenceLabel: "Clearer weekly pattern",
    note: "This view is based on a fuller week of journaling language and mood check-ins.",
  },
  summary: {
    headline: "Morning Routines kept shaping your week",
    narrative:
      "Your writing had more structure than it may have felt. Morning routines kept resurfacing, while work stress stayed close enough to deserve a gentler plan.",
    highlight:
      "The clearest thread was Morning Routines. Keep watching what triggers it, what softens it, and what you need around it next week.",
  },
  patternTags: [
    { label: "Morning Routines", tone: "coral" as const },
    { label: "Work Stress", tone: "amber" as const },
    { label: "Connection Energy", tone: "sage" as const },
  ],
  scoreboard: {
    vibeLabel: "Steadier week",
    vibeTone: "sage" as const,
    cards: [
      { key: "activeDays" as const, label: "Active days", value: "5/7", tone: "sage" as const },
      { key: "entries" as const, label: "Entries", value: "6", tone: "blue" as const },
      { key: "words" as const, label: "Words", value: "842", tone: "amber" as const },
      { key: "mood" as const, label: "Mood signal", value: "Good", tone: "sage" as const },
    ],
  },
  emotionTrend: {
    headline: "Emotional pace across the week",
    days: [
      {
        dateKey: "2026-03-26",
        label: "Thu",
        moodLabel: "Good",
        moodScore: 4,
        entryCount: 1,
        tone: "sage" as const,
      },
      {
        dateKey: "2026-03-27",
        label: "Fri",
        moodLabel: null,
        moodScore: null,
        entryCount: 0,
        tone: "blue" as const,
      },
      {
        dateKey: "2026-03-28",
        label: "Sat",
        moodLabel: "Amazing",
        moodScore: 5,
        entryCount: 2,
        tone: "sage" as const,
      },
      {
        dateKey: "2026-03-29",
        label: "Sun",
        moodLabel: "Okay",
        moodScore: 3,
        entryCount: 1,
        tone: "blue" as const,
      },
      {
        dateKey: "2026-03-30",
        label: "Mon",
        moodLabel: "Good",
        moodScore: 4,
        entryCount: 1,
        tone: "sage" as const,
      },
      {
        dateKey: "2026-03-31",
        label: "Tue",
        moodLabel: "Bad",
        moodScore: 2,
        entryCount: 1,
        tone: "slate" as const,
      },
      {
        dateKey: "2026-04-01",
        label: "Wed",
        moodLabel: "Good",
        moodScore: 4,
        entryCount: 0,
        tone: "sage" as const,
      },
    ],
  },
  themeBreakdown: {
    headline: "Themes that kept resurfacing",
    items: [
      { label: "Morning Routines", count: 4, percentage: 36, tone: "coral" as const },
      { label: "Work Stress", count: 3, percentage: 28, tone: "blue" as const },
      { label: "Relationships", count: 2, percentage: 18, tone: "sage" as const },
    ],
  },
  signals: {
    whatHelped: [
      {
        title: "Consistency gave the week more shape",
        description: "A 4-day streak kept your reflection rhythm steadier than usual.",
        evidence: ["5/7 active days", "6 entries"],
        tone: "sage" as const,
      },
    ],
    whatDrained: [
      {
        title: "Work Stress kept pulling focus",
        description:
          "That topic returned often enough to look like a live friction point rather than a one-off mention.",
        evidence: ["3 mentions", "Work Stress"],
        tone: "amber" as const,
      },
    ],
    whatKeptShowingUp: [
      {
        title: "Morning Routines",
        description:
          "This theme showed up most often, so it is probably the clearest thread to keep tracking next week.",
        evidence: ["4 mentions", "36% topic share"],
        tone: "coral" as const,
      },
    ],
  },
  bigFive: [
    {
      trait: "conscientiousness" as const,
      label: "Conscientiousness",
      score: 74,
      band: "pronounced" as const,
      description: "Your writing rhythm appears structured this week, supported by a 4-day streak.",
      evidenceTags: ["4-day streak", "Routine"],
    },
  ],
  darkTriad: [
    {
      trait: "machiavellianism" as const,
      label: "Machiavellianism",
      supportiveLabel: "Control-seeking signal",
      score: 42,
      band: "watch" as const,
      description: "There are mild signs of control-seeking or strategic guarding in the week.",
      supportTip:
        "When planning next steps, add one sentence about flexibility or what you can let unfold naturally.",
    },
  ],
  actionPlan: {
    headline: "Keep the good structure, lower the friction, and stay with the clearest theme.",
    steps: [
      {
        title: "Keep one reset you can repeat",
        description:
          "Pick one part of your routine that already feels steady and run it back for the next three days.",
        focus: "Consistency",
      },
      {
        title: "Name the stress sooner",
        description:
          "When work pressure starts climbing, write one line about the trigger before it turns into a whole spiral.",
        focus: "Work Stress",
      },
      {
        title: "Stay with the same thread",
        description:
          "Use morning routines as the lens for your next entry so you can spot what is actually shifting underneath it.",
        focus: "Morning Routines",
      },
    ],
  },
  appSupport: {
    headline: "Journal.IO can help make the next week easier to read at a glance.",
    items: [
      {
        title: "Mood check-ins can catch the shift faster",
        description:
          "Keeping the mood tracker active helps confirm whether good stays steady or starts dipping around stress spikes.",
      },
      {
        title: "Tags keep recurring themes visible",
        description:
          "Consistent tags make it easier to notice when morning routines or work stress keep circling back.",
      },
      {
        title: "Short prompts help you go from venting to noticing",
        description:
          "A focused prompt can help you move from raw recap into the part that is actually useful next time.",
      },
    ],
  },
};

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
  getInsightsAiAnalysis: jest.fn(async () => readyAiAnalysis),
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
      await new Promise<void>(resolve => {
        setTimeout(resolve, 0);
      });
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
  expect(analysisTree).toContain("Morning Routines kept shaping your week");
  expect(analysisTree).toContain("Steadier week");
  expect(analysisTree).toContain("Pattern snapshot");
  expect(analysisTree).toContain("What Helped");
  expect(analysisTree).toContain("Consistency gave the week more shape");
  expect(analysisTree).toContain("What Drained");
  expect(analysisTree).toContain("Work Stress kept pulling focus");
  expect(analysisTree).toContain("Morning Routines");
  expect(analysisTree).toContain("Actionable Steps");
  expect(analysisTree).toContain("Keep one reset you can repeat");
  expect(analysisTree).not.toContain("What Kept Showing Up");
  expect(analysisTree).not.toContain("How Journal.IO Helps");
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
  expect(useAppStore.getState().stage).toBe("paywall");
  expect(useAppStore.getState().activePaywallPlacementKey).toBe(
    "insights_ai_tab_locked"
  );
  expect(tree).toContain("Insights");
  expect(tree).toContain("AI Analysis");
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
  expect(tree).toContain(
    "AI reflections are off for this account, so weekly AI analysis stays hidden."
  );
});

test("shows the collecting state while the current premium week is still open", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  (getInsightsAiAnalysis as jest.Mock).mockImplementation(async () => ({
    status: "collecting",
    window: {
      startDate: "2026-04-11",
      endDate: "2026-04-17",
      label: "Apr 11 - Apr 17",
      entryCount: 2,
      activeDays: 2,
      totalWords: 248,
    },
    progress: {
      activeDays: 2,
      minimumActiveDays: 4,
      entriesNeeded: 2,
      daysRemaining: 4,
    },
    summary: {
      headline: "Your first weekly read is still collecting signal",
      narrative:
        "You’re still inside this premium week, so Journal.IO is waiting for a little more texture before it turns the week into a real read.",
      highlight:
        "Two active days are already on the board. Hit four and the week becomes eligible for AI insights.",
    },
    quickAnalysis: {
      available: true,
      title: "Quick Analysis is available now",
      description:
        "Open any saved journal entry to get a short AI reflection while the weekly view is still collecting.",
    },
  }));

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

  await ReactTestRenderer.act(async () => {
    root!.root.findByProps({ accessibilityLabel: "AI Analysis" }).props.onPress();
  });

  await waitForText(root!, "Your first weekly read is still collecting signal");

  const tree = extractText(root!.toJSON());

  expect(tree).toContain("Your first weekly read is still collecting signal");
  expect(tree).toContain("4days left");
  expect(tree).toContain("active days");
  expect(tree).toContain("Quick Analysis is available now");
  expect(tree).toContain("Week window: Apr 11 - Apr 17");
});
