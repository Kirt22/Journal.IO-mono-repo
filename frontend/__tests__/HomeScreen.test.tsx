/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HomeScreen from "../src/screens/HomeScreen";
import { createJournalEntry } from "../src/services/journalService";
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
  getTodayMoodCheckIn: jest.fn().mockResolvedValue(null),
  logMoodCheckIn: jest.fn(async mood => ({
    _id: "mood-test-entry",
    mood,
    moodDateKey: "2026-01-01",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T08:00:00.000Z",
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

test("renders the home screen layout", async () => {
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
    await flushMicrotasks();
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(tree).toContain("Current Streak");
  expect(tree).toContain("Capture a quick thought...");
  expect(tree).toContain("AI Insight");
  expect(tree).toContain("Today's Prompt");
  expect(tree).toContain("Recent Entries");
  expect(tree).toContain("Morning Reflections");

  const newEntryButton = root!.root.findAllByProps({
    accessibilityLabel: "Create new entry",
  })[0];

  ReactTestRenderer.act(() => {
    newEntryButton.props.onPress();
  });

  expect(onOpenNewEntry).toHaveBeenCalled();
});

test("opens the calendar tab from the home calendar card", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
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
        _id: string;
        mood: "amazing" | "good" | "okay" | "bad" | "terrible";
        moodDateKey: string;
        createdAt: string;
        updatedAt: string;
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
      _id: "mood-existing-entry",
      mood: "good",
      moodDateKey: "2026-01-01",
      createdAt: "2026-01-01T08:00:00.000Z",
      updatedAt: "2026-01-01T08:00:00.000Z",
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
    "You can log one mood check-in per day."
  );

  const moodButton = root!.root.findAllByProps({
    accessibilityLabel: "Good",
  })[0];

  expect(moodButton.props.disabled).toBe(true);
});

test("saves quick thoughts into recent entries", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
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
    })
  );

  const tree = JSON.stringify(root!.toJSON());

  expect(tree).toContain("Recent Entries");
  expect(tree).toContain("A quick note about walking outside");
  expect(tree).toContain("Quick Thought");
  expect(tree).not.toContain("Journal entry");
  expect(tree).not.toContain("No entries yet");
});

test("opens a journal detail from a recent entry", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
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
