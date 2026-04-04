/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { calendarSampleJournalEntries } from "../src/models/calendarModels";
import HomeScreen from "../src/screens/HomeScreen";
import { createJournalEntry } from "../src/services/journalService";
import { getInsightsAiAnalysis } from "../src/services/insightsService";
import {
  getTodayMoodCheckIn,
  logMoodCheckIn,
} from "../src/services/moodService";
import { resetAppStore, useAppStore } from "../src/store/appStore";

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
    ],
    darkTriad: [
      {
        trait: "machiavellianism",
        label: "Machiavellianism",
        supportiveLabel: "Control-seeking signal",
        score: 42,
        band: "watch",
        description:
          "There are mild signs of control-seeking or strategic guarding in the week.",
        supportTip:
          "When planning next steps, add one sentence about flexibility or what you can let unfold naturally.",
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
      ],
    },
    appSupport: {
      headline: "Journal.IO can help turn these patterns into gentler habits over time.",
      items: [
        {
          title: "Tags make recurring topics easier to spot",
          description:
            "Tagging entries consistently helps the app notice when themes like morning routines keep returning.",
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

const setPremiumSession = (isPremium: boolean) => {
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
      },
    },
  });
};

const seedRecentEntries = (count = 1) => {
  useAppStore.getState().setRecentJournalEntries(calendarSampleJournalEntries.slice(0, count));
};

beforeEach(() => {
  jest.clearAllMocks();
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
  expect(tree).toContain("Current Streak");
  expect(tree).toContain("4");
  expect(tree).toContain("days");
  expect(tree).toContain("Capture a quick thought...");
  expect(tree).toContain("AI Insight");
  expect(tree).toContain("Conscientiousness stood out most this week");
  expect(tree).toContain("Mar 26 - Apr 1");
  expect(tree).toContain("Today's Prompt");
  expect(tree).toContain("Recent Entries");
  expect(tree).toContain("No entries yet");

  const newEntryButton = root!.root.findAllByProps({
    accessibilityLabel: "Create new entry",
  })[0];

  ReactTestRenderer.act(() => {
    newEntryButton.props.onPress();
  });

  expect(onOpenNewEntry).toHaveBeenCalled();
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
    "Conscientiousness stood out most this week"
  );

  ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityLabel: "Next insight" }).props.onPress();
  });

  expect(JSON.stringify(root!.toJSON())).toContain("Conscientiousness stood out");
  expect(JSON.stringify(root!.toJSON())).toContain("4-day streak");
  expect(JSON.stringify(root!.toJSON())).toContain("View full trait read");
  expect(JSON.stringify(root!.toJSON())).not.toContain("Routine");

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

  expect(useAppStore.getState().activeTab).toBe("profile");
});
