/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { calendarSampleJournalEntries } from "../src/models/calendarModels";
import HomeScreen from "../src/screens/HomeScreen";
import { createJournalEntry } from "../src/services/journalService";
import { getInsightsAiAnalysis } from "../src/services/insightsService";
import { getWritingPrompts } from "../src/services/promptsService";
import {
  getTodayMoodCheckIn,
  logMoodCheckIn,
} from "../src/services/moodService";
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
    ],
  },
  themeBreakdown: {
    headline: "Themes that kept resurfacing",
    items: [
      { label: "Morning Routines", count: 4, percentage: 36, tone: "coral" as const },
      { label: "Work Stress", count: 3, percentage: 28, tone: "blue" as const },
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
    ],
  },
};

jest.mock("../src/services/journalService", () => ({
  getJournalEntries: jest.fn().mockResolvedValue([]),
  createJournalEntry: jest.fn(async payload => ({
    _id: "journal-test-entry",
    title: payload.title,
    content: payload.content,
    type: payload.type || "journal",
    images: [],
    tags: payload.tags || [],
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T08:00:00.000Z",
  })),
}));

jest.mock("../src/services/moodService", () => ({
  getTodayMoodCheckIn: jest.fn().mockResolvedValue({
    moodCheckIn: null,
    currentStreak: 4,
  }),
  logMoodCheckIn: jest.fn(async mood => ({
    _id: "mood-test-entry",
    mood,
    moodDateKey: "2026-01-01",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T08:00:00.000Z",
  })),
}));

jest.mock("../src/services/insightsService", () => ({
  getInsightsAiAnalysis: jest.fn(async () => readyAiAnalysis),
}));

jest.mock("../src/services/promptsService", () => ({
  getWritingPrompts: jest.fn(async () => ({
    featuredPrompt: {
      id: "patterns-1",
      topic: "Patterns",
      text: "Where did your mood shift, and what seemed to influence it?",
    },
    prompts: [
      {
        id: "patterns-1",
        topic: "Patterns",
        text: "Where did your mood shift, and what seemed to influence it?",
      },
      {
        id: "next-step-2",
        topic: "Next Step",
        text: "What is one small habit you want to reinforce tomorrow?",
      },
    ],
    source: "personalized",
    generatedAt: "2026-04-06T10:00:00.000Z",
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

const flushMicrotasks = () =>
  Promise.resolve().then(() => Promise.resolve());

const flushAsyncWork = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  await flushMicrotasks();
};

const waitForTreeText = async (
  root: ReactTestRenderer.ReactTestRenderer,
  expectedText: string,
  attempts = 8
) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const tree = JSON.stringify(root.toJSON());

    if (tree.includes(expectedText)) {
      return;
    }

    await ReactTestRenderer.act(async () => {
      await flushAsyncWork();
    });
  }

  throw new Error(`Timed out waiting for text: ${expectedText}`);
};

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

const seedRecentEntries = (count = 1) => {
  useAppStore.getState().setRecentJournalEntries(calendarSampleJournalEntries.slice(0, count));
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("renders the home screen layout", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onOpenNewEntry = jest.fn();

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <HomeScreen
          userName="Journal User"
          onOpenNewEntry={onOpenNewEntry}
          onOpenStreaks={jest.fn()}
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
    await flushMicrotasks();
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(getInsightsAiAnalysis).toHaveBeenCalledTimes(1);
  expect(getWritingPrompts).toHaveBeenCalledTimes(1);
  expect(tree).toContain("Current Streak");
  expect(tree).toContain("4");
  expect(tree).toContain("days");
  expect(tree).toContain("Capture a quick thought...");
  expect(tree).toContain("AI Insight");
  expect(tree).toContain("Morning Routines kept shaping your week");
  expect(tree).toContain("Mar 26 - Apr 1");
  expect(tree).toContain("Today's Prompt");
  expect(tree).toContain(
    "Where did your mood shift, and what seemed to influence it?"
  );
  expect(tree).toContain("Recent Entries");
  expect(tree).toContain("No entries yet");

  const newEntryButton = root!.root.findAllByProps({
    accessibilityLabel: "Create new entry",
  })[0];

  ReactTestRenderer.act(() => {
    newEntryButton.props.onPress();
  });

  expect(onOpenNewEntry).toHaveBeenCalled();

  const promptCard = root!.root.findByProps({
    accessibilityLabel:
      "Open today's writing prompt: Where did your mood shift, and what seemed to influence it?",
  });

  ReactTestRenderer.act(() => {
    promptCard.props.onPress();
  });

  expect(onOpenNewEntry).toHaveBeenCalledWith(
    "Where did your mood shift, and what seemed to influence it?"
  );

  const promptsButton = root!.root.findByProps({
    accessibilityLabel: "Open prompts",
  });

  ReactTestRenderer.act(() => {
    promptsButton.props.onPress();
  });

  expect(Alert.alert).toHaveBeenCalledWith(
    "Coming soon",
    "Prompt shortcuts are coming soon."
  );
  expect(onOpenNewEntry).toHaveBeenCalledTimes(2);
});

test("opens search from the home search icon", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onOpenSearch = jest.fn();

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <HomeScreen
          userName="Journal User"
          onOpenNewEntry={jest.fn()}
          onOpenStreaks={jest.fn()}
          onOpenSearch={onOpenSearch}
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
    await flushMicrotasks();
  });

  const searchButton = root!.root.findByProps({
    accessibilityLabel: "Search",
  });

  ReactTestRenderer.act(() => {
    searchButton.props.onPress();
  });

  expect(onOpenSearch).toHaveBeenCalledTimes(1);
});

test("opens reminders from the home bell icon", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onOpenReminders = jest.fn();

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <HomeScreen
          userName="Journal User"
          onOpenNewEntry={jest.fn()}
          onOpenStreaks={jest.fn()}
          onOpenSearch={jest.fn()}
          onOpenReminders={onOpenReminders}
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
    await flushMicrotasks();
  });

  const reminderButton = root!.root.findByProps({
    accessibilityLabel: "Reminders",
  });

  ReactTestRenderer.act(() => {
    reminderButton.props.onPress();
  });

  expect(onOpenReminders).toHaveBeenCalledTimes(1);
});

test("cycles home AI insights and opens the full AI analysis tab", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <HomeScreen
          userName="Journal User"
          onOpenNewEntry={jest.fn()}
          onOpenStreaks={jest.fn()}
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
    await flushMicrotasks();
  });

  expect(JSON.stringify(root!.toJSON())).toContain(
    "Morning Routines kept shaping your week"
  );

  ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityLabel: "Next insight" }).props.onPress();
  });

  expect(JSON.stringify(root!.toJSON())).toContain("Consistency gave the week more shape");
  expect(JSON.stringify(root!.toJSON())).toContain("5/7 active days stood out most");
  expect(JSON.stringify(root!.toJSON())).toContain("See what helped");
  expect(JSON.stringify(root!.toJSON())).not.toContain("Open weekly analysis");

  ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityLabel: "Open AI analysis" }).props.onPress();
  });

  expect(useAppStore.getState().activeTab).toBe("insights");
  expect(useAppStore.getState().preferredInsightsTab).toBe("analysis");
});

test("opens the calendar tab from the home calendar card", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <HomeScreen
          userName="Journal User"
          onOpenNewEntry={jest.fn()}
          onOpenStreaks={jest.fn()}
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
    await flushMicrotasks();
  });

  const calendarButton = root!.root.findAllByProps({
    accessibilityLabel: "Open calendar",
  })[0];

  ReactTestRenderer.act(() => {
    calendarButton.props.onPress();
  });

  expect(useAppStore.getState().activeTab).toBe("calendar");
});

test("logs home mood selections as check-ins", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <HomeScreen
          userName="Journal User"
          onOpenNewEntry={jest.fn()}
          onOpenStreaks={jest.fn()}
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
    await flushMicrotasks();
  });

  const moodButton = root!.root.findAllByProps({
    accessibilityLabel: "Good",
  })[0];

  await ReactTestRenderer.act(async () => {
    await moodButton.props.onPress();
  });

  expect(logMoodCheckIn).toHaveBeenCalledWith("good");
  expect(JSON.stringify(root!.toJSON())).toContain(
    "Mood logged for today. Come back tomorrow to update it."
  );
});

test("locks the mood card when today's mood already exists", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  let resolveMoodCheckIn:
    | ((value: {
        moodCheckIn: {
          _id: string;
          mood: "amazing" | "good" | "okay" | "bad" | "terrible";
          moodDateKey: string;
          createdAt: string;
          updatedAt: string;
        } | null;
        currentStreak: number;
      }) => void)
    | null = null;

  (getTodayMoodCheckIn as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveMoodCheckIn = resolve;
      })
  );

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <HomeScreen
          userName="Journal User"
          onOpenNewEntry={jest.fn()}
          onOpenStreaks={jest.fn()}
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
  });

  await ReactTestRenderer.act(async () => {
    resolveMoodCheckIn?.({
      moodCheckIn: {
        _id: "mood-existing-entry",
        mood: "good",
        moodDateKey: "2026-01-01",
        createdAt: "2026-01-01T08:00:00.000Z",
        updatedAt: "2026-01-01T08:00:00.000Z",
      },
      currentStreak: 6,
    });
    await flushAsyncWork();
  });

  expect(resolveMoodCheckIn).not.toBeNull();
  await ReactTestRenderer.act(async () => {
    await flushAsyncWork();
  });

  expect(getTodayMoodCheckIn).toHaveBeenCalled();
  await waitForTreeText(
    root!,
    "Mood logged for today. Come back tomorrow to update it."
  );

  const moodButton = root!.root.findAllByProps({
    accessibilityLabel: "Good",
  })[0];

  expect(moodButton.props.disabled).toBe(true);
  expect(JSON.stringify(root!.toJSON())).toContain("6");
});

test("saves quick thoughts into recent entries", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <HomeScreen
          userName="Journal User"
          onOpenNewEntry={jest.fn()}
          onOpenStreaks={jest.fn()}
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
    await flushMicrotasks();
  });

  const openQuickThoughtButton = root!.root.findByProps({
    accessibilityLabel: "Open quick thought",
  });

  ReactTestRenderer.act(() => {
    openQuickThoughtButton.props.onPress();
  });

  const noteInput = root!.root.findByProps({
    placeholder: "What's on your mind?",
  });

  ReactTestRenderer.act(() => {
    noteInput.props.onChangeText("A quick note about walking outside");
  });

  ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityLabel: "gratitude" }).props.onPress();
  });

  const saveQuickThoughtButton = root!.root.findByProps({
    accessibilityLabel: "Save quick thought",
  });

  await ReactTestRenderer.act(async () => {
    await saveQuickThoughtButton.props.onPress();
  });

  expect(createJournalEntry).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Quick Thought",
      content: "A quick note about walking outside",
      type: "quick-thought",
      tags: ["gratitude"],
    })
  );

  const tree = JSON.stringify(root!.toJSON());

  expect(tree).toContain("Recent Entries");
  expect(tree).toContain("A quick note about walking outside");
  expect(tree).toContain("Quick Thought");
  expect(tree).toContain("5");
  expect(tree).not.toContain("Journal entry");
  expect(tree).not.toContain("No entries yet");
  expect(root!.root.findAllByProps({ placeholder: "What's on your mind?" })).toHaveLength(0);
  expect(logSpy).toHaveBeenCalledWith(
    "[HomeScreen] Quick thought save tapped",
    expect.objectContaining({
      contentLength: "A quick note about walking outside".length,
      selectedTags: ["gratitude"],
    })
  );
  expect(logSpy).toHaveBeenCalledWith(
    "[HomeScreen] Quick thought request succeeded",
    expect.objectContaining({
      journalId: "journal-test-entry",
      title: "Quick Thought",
      type: "quick-thought",
      tags: ["gratitude"],
    })
  );
  expect(logSpy).toHaveBeenCalledWith("[HomeScreen] Quick thought UI cleaned up");
  expect(errorSpy).not.toHaveBeenCalled();

  logSpy.mockRestore();
  errorSpy.mockRestore();
});

test("opens a journal detail from a recent entry", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <HomeScreen
          userName="Journal User"
          onOpenNewEntry={jest.fn()}
          onOpenStreaks={jest.fn()}
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
    await Promise.resolve();
  });

  ReactTestRenderer.act(() => {
    seedRecentEntries(1);
  });

  await waitForTreeText(root!, "Morning Reflections");

  const firstOpenEntryButton = root!.root
    .findAllByProps({ accessibilityRole: "button" })
    .find(
      node =>
        typeof node.props.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Open entry")
    );

  expect(firstOpenEntryButton).toBeTruthy();

  ReactTestRenderer.act(() => {
    firstOpenEntryButton!.props.onPress();
  });

  expect(useAppStore.getState().stage).toBe("journal-detail");
  expect(useAppStore.getState().selectedJournalEntryId).toBe("mar-15");
});

test("shows the calendar hint after the tenth recent entry", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
    seedRecentEntries(10);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <HomeScreen
          userName="Journal User"
          onOpenNewEntry={jest.fn()}
          onOpenStreaks={jest.fn()}
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
    await Promise.resolve();
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(tree).toContain("Morning Reflections");
  expect(tree).toContain(
    "See Calendar for more details and the full entry history."
  );
});

test("opens the full editor from quick thought", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onOpenNewEntry = jest.fn();

  ReactTestRenderer.act(() => {
    resetAppStore();
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <HomeScreen
          userName="Journal User"
          onOpenNewEntry={onOpenNewEntry}
          onOpenStreaks={jest.fn()}
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
    await Promise.resolve();
  });

  const openQuickThoughtButton = root!.root.findByProps({
    accessibilityLabel: "Open quick thought",
  });

  ReactTestRenderer.act(() => {
    openQuickThoughtButton.props.onPress();
  });

  const openFullEditorButton = root!.root.findByProps({
    accessibilityLabel: "Open full editor",
  });

  ReactTestRenderer.act(() => {
    openFullEditorButton.props.onPress();
  });

  expect(onOpenNewEntry).toHaveBeenCalled();
});

test("shows a locked AI insight card for non-premium users", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(false);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <HomeScreen
          userName="Journal User"
          onOpenNewEntry={jest.fn()}
          onOpenStreaks={jest.fn()}
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
    await flushMicrotasks();
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(getInsightsAiAnalysis).toHaveBeenCalledTimes(0);
  expect(tree).toContain("Premium AI Insight");
  expect(tree).toContain("Upgrade to Premium");

  ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityLabel: "Open AI analysis" }).props.onPress();
  });

  expect(useAppStore.getState().stage).toBe("paywall");
  expect(useAppStore.getState().activePaywallPlacementKey).toBe(
    "home_ai_card_locked"
  );
});

test("shows an AI opt-out card instead of loading AI insights", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true, false);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <HomeScreen
          userName="Journal User"
          onOpenNewEntry={jest.fn()}
          onOpenStreaks={jest.fn()}
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
    await flushMicrotasks();
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(getInsightsAiAnalysis).toHaveBeenCalledTimes(0);
  expect(tree).toContain("AI insights are turned off");
  expect(tree).toContain(
    "AI reflections are off for this account, so weekly AI insight cards stay hidden."
  );

  ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityLabel: "Open AI analysis" }).props.onPress();
  });

  expect(useAppStore.getState().activeTab).toBe("insights");
  expect(useAppStore.getState().preferredInsightsTab).toBe("analysis");
});
