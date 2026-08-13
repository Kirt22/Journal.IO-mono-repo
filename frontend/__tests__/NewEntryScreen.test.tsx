/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NewEntryScreen from "../src/screens/NewEntryScreen";
import {
  createJournalEntry,
  getJournalSessionAnalysis,
} from "../src/services/journalService";
import { getWritingPrompts } from "../src/services/promptsService";
import { cancelWeeklyInsightNotifications } from "../src/services/reminderNotificationsService";
import { navigateMainApp } from "../src/navigation/navigation";
import { resetAppStore, useAppStore } from "../src/store/appStore";
import {
  reportBackendReachable,
  reportBackendUnavailable,
  resetConnectivityForTests,
} from "../src/services/connectivityService";

jest.mock("../src/navigation/navigation", () => ({
  ...jest.requireActual("../src/navigation/navigation"),
  navigateMainApp: jest.fn(),
}));

jest.mock("../src/services/journalService", () => ({
  createJournalEntry: jest.fn(async payload => ({
    _id: "journal-test-entry",
    title: payload.title,
    content: payload.content,
    type: payload.type || "journal",
    aiPrompt: payload.aiPrompt ?? null,
    images: [],
    tags: payload.tags || [],
    isFavorite: false,
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T08:00:00.000Z",
  })),
  getJournalSessionAnalysis: jest.fn(async () => ({
    analysis: "A short read on this entry.",
    majorInsight: "Major insight: bounded progress beats urgency.",
    observedTrends: ["Focus"],
    topicsObserved: ["focus"],
    detectedTopics: ["focus"],
    detectedMood: "good",
    hasEnoughSignal: true,
  })),
}));

jest.mock("../src/services/promptsService", () => ({
  getWritingPrompts: jest.fn(async () => ({
    featuredPrompt: {
      id: "gratitude-1",
      topic: "Gratitude",
      text: "What are you grateful for today?",
    },
    prompts: [
      {
        id: "gratitude-1",
        topic: "Gratitude",
        text: "What are you grateful for today?",
      },
      {
        id: "patterns-2",
        topic: "Patterns",
        text: "What challenged you recently and what did you learn?",
      },
    ],
    source: "personalized",
    generatedAt: "2026-04-06T10:00:00.000Z",
  })),
}));

jest.mock("../src/services/hapticsService", () => ({
  triggerHaptic: jest.fn(async () => undefined),
  stopHaptics: jest.fn(),
}));

jest.mock("../src/services/remindersService", () => ({
  getPrimaryDailyReminder: jest.fn(async () => null),
}));

jest.mock("../src/services/reminderNotificationsService", () => ({
  syncReminderNotifications: jest.fn(async () => undefined),
  cancelWeeklyInsightNotifications: jest.fn(async () => undefined),
}));

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS");

beforeEach(() => {
  // Finishing an entry holds the loader for a minimum dwell, so the save path
  // has to be driven past a real timer.
  jest.useFakeTimers();
  if (originalPlatformDescriptor) {
    Object.defineProperty(Platform, "OS", originalPlatformDescriptor);
  }
  resetConnectivityForTests("online");
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
  (createJournalEntry as jest.Mock).mockClear();
  (getJournalSessionAnalysis as jest.Mock).mockClear();
  (getWritingPrompts as jest.Mock).mockClear();
  (cancelWeeklyInsightNotifications as jest.Mock).mockClear();
  (navigateMainApp as jest.Mock).mockClear();
});

afterAll(() => {
  if (originalPlatformDescriptor) {
    Object.defineProperty(Platform, "OS", originalPlatformDescriptor);
  }
});

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

let mountedRoot: ReactTestRenderer.ReactTestRenderer | null = null;

const renderScreen = async (props: React.ComponentProps<typeof NewEntryScreen>) => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <NewEntryScreen {...props} />
      </SafeAreaProvider>
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  mountedRoot = root;
  return root;
};

// The sheet and prompt-wheel animations schedule frames; leaving the tree
// mounted lets one commit after the environment is torn down.
afterEach(() => {
  if (!mountedRoot) {
    return;
  }

  const root = mountedRoot;
  mountedRoot = null;
  ReactTestRenderer.act(() => root.unmount());
  jest.useRealTimers();
});

const typeContent = async (
  root: ReactTestRenderer.ReactTestRenderer,
  text: string
) => {
  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: "Entry content" })
      .props.onChangeText(text);
    await Promise.resolve();
  });
};

/**
 * Save no longer writes straight through — it opens the confirm sheet, and the
 * unhighlighted "Finish entry" option is what commits. The commit then holds
 * the finish loader for a minimum dwell before navigating.
 */
const MIN_FINISH_DWELL_MS = 1500;

const saveThroughConfirmSheet = async (
  root: ReactTestRenderer.ReactTestRenderer
) => {
  await ReactTestRenderer.act(async () => {
    root.root.findByProps({ accessibilityLabel: "Save entry" }).props.onPress();
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: "Finish entry" })
      .props.onPress();
    await jest.advanceTimersByTimeAsync(MIN_FINISH_DWELL_MS);
  });
};

test("renders the open entry screen and keeps Save inert until something is written", async () => {
  const onBack = jest.fn();
  const root = await renderScreen({ onBack });

  const tree = extractText(root.toJSON());

  expect(tree).toContain("Open Entry");
  expect(tree).not.toContain("New Entry");
  expect(tree).not.toContain("Show Writing Prompts");
  expect(
    root.root.findByProps({ accessibilityLabel: "Entry content" }).props
      .inputAccessoryViewID
  ).toBe("new-entry-keyboard-actions");
  expect(
    root.root.findByProps({ accessibilityLabel: "Dismiss keyboard" })
  ).toBeTruthy();

  // Empty content is now expressed in the button state rather than an error
  // message the user only sees after tapping.
  const saveButton = root.root.findByProps({ accessibilityLabel: "Save entry" });
  expect(saveButton.props.disabled).toBe(true);

  await ReactTestRenderer.act(async () => {
    saveButton.props.onPress();
  });

  expect(createJournalEntry).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => {
    root.root.findByProps({ accessibilityLabel: "Back" }).props.onPress();
  });

  expect(onBack).toHaveBeenCalled();
});

test("loads a writing prompt on mount and adds it to the entry when tapped", async () => {
  const root = await renderScreen({ onBack: jest.fn() });

  expect(getWritingPrompts).toHaveBeenCalledTimes(1);

  await typeContent(root, "A calm reset after a busy meeting");

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({
        accessibilityLabel:
          "Add writing prompt to your entry: What are you grateful for today?",
      })
      .props.onPress();
    await Promise.resolve();
  });

  expect(
    root.root.findByProps({ accessibilityLabel: "Entry content" }).props.value
  ).toMatch(
    /A calm reset after a busy meeting[\s\S]*What are you grateful for today\?/
  );
});

test("refreshing scrolls the next prompt into the slot", async () => {
  const root = await renderScreen({ onBack: jest.fn() });

  expect(extractText(root.toJSON())).toContain(
    "What are you grateful for today?"
  );

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: "Show another writing prompt" })
      .props.onPress();
    await Promise.resolve();
  });

  // Mid-wheel both prompts are mounted: the outgoing one falling out of the
  // slot and the new one dropping in from above. The new one is committed on
  // the tap itself, so nothing swaps when the wheel lands.
  let treeText = extractText(root.toJSON());
  expect(treeText).toContain(
    "What challenged you recently and what did you learn?"
  );
  expect(treeText).toContain("What are you grateful for today?");

  // Once the wheel settles only the new prompt is left in the slot.
  await ReactTestRenderer.act(async () => {
    await jest.advanceTimersByTimeAsync(400);
  });

  treeText = extractText(root.toJSON());
  expect(treeText).toContain(
    "What challenged you recently and what did you learn?"
  );
  expect(treeText).not.toContain("What are you grateful for today?");
});

test("seeds today's reflection into the prompt slot rather than the entry body", async () => {
  const root = await renderScreen({
    onBack: jest.fn(),
    initialPrompt: "What felt most steady or grounding in your day?",
  });

  // The user decides whether the reflection becomes part of the entry.
  expect(
    root.root.findByProps({ accessibilityLabel: "Entry content" }).props.value
  ).toBe("");
  expect(
    root.root.findByProps({
      accessibilityLabel:
        "Add writing prompt to your entry: What felt most steady or grounding in your day?",
    })
  ).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({
        accessibilityLabel:
          "Add writing prompt to your entry: What felt most steady or grounding in your day?",
      })
      .props.onPress();
    await Promise.resolve();
  });

  expect(
    root.root.findByProps({ accessibilityLabel: "Entry content" }).props.value
  ).toContain("What felt most steady or grounding in your day?");
});

test("saves an entry through the confirm sheet and returns to home", async () => {
  const onBack = jest.fn();
  const root = await renderScreen({ onBack });

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: "Entry title" })
      .props.onChangeText("Afternoon note");
  });
  await typeContent(root, "A calm reset after a busy meeting");

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({
        accessibilityLabel:
          "Add writing prompt to your entry: What are you grateful for today?",
      })
      .props.onPress();
    await Promise.resolve();
  });

  await saveThroughConfirmSheet(root);

  expect(createJournalEntry).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Afternoon note",
      content: expect.stringMatching(
        /A calm reset after a busy meeting[\s\S]*What are you grateful for today\?/
      ),
      type: "open_ended",
      aiPrompt: "What are you grateful for today?",
    })
  );
  expect(cancelWeeklyInsightNotifications).toHaveBeenCalledTimes(1);
  expect(onBack).not.toHaveBeenCalled();
  expect(useAppStore.getState().stage).toBe("main-app");
  expect(useAppStore.getState().activeTab).toBe("home");
  expect(useAppStore.getState().selectedJournalEntryId).toBeNull();
});

test("holds the finish loader for a beat before leaving the composer", async () => {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: "ios",
  });
  ReactTestRenderer.act(() => {
    setPremiumSession(false);
  });

  const root = await renderScreen({ onBack: jest.fn() });
  await typeContent(root, "A free entry should not snap straight to the lock.");

  await ReactTestRenderer.act(async () => {
    root.root.findByProps({ accessibilityLabel: "Save entry" }).props.onPress();
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: "Finish entry" })
      .props.onPress();
    await jest.advanceTimersByTimeAsync(400);
  });

  // Free users have no analysis request to wait on, so without the dwell the
  // locked screen would appear the instant the entry persisted.
  expect(createJournalEntry).toHaveBeenCalledTimes(1);
  expect(navigateMainApp).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    await jest.advanceTimersByTimeAsync(MIN_FINISH_DWELL_MS);
  });

  expect(navigateMainApp).toHaveBeenCalledWith(
    "EntrySessionAnalysis",
    expect.objectContaining({ journalId: "journal-test-entry" })
  );
});

test("keeps writing when the sheet's highlighted option is chosen", async () => {
  const root = await renderScreen({ onBack: jest.fn() });

  await typeContent(root, "Not finished with this thought yet");

  await ReactTestRenderer.act(async () => {
    root.root.findByProps({ accessibilityLabel: "Save entry" }).props.onPress();
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    root.root.findByProps({ accessibilityLabel: "Write more" }).props.onPress();
    await Promise.resolve();
  });

  expect(createJournalEntry).not.toHaveBeenCalled();
  expect(
    root.root.findByProps({ accessibilityLabel: "Entry content" }).props.value
  ).toBe("Not finished with this thought yet");
});

test("hands the session analysis to the next screen so it opens without a loader", async () => {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: "ios",
  });
  ReactTestRenderer.act(() => {
    setPremiumSession(true);
  });

  const root = await renderScreen({ onBack: jest.fn() });
  await typeContent(root, "A premium entry that should carry its analysis.");
  await saveThroughConfirmSheet(root);

  expect(getJournalSessionAnalysis).toHaveBeenCalledWith("journal-test-entry");
  expect(navigateMainApp).toHaveBeenCalledWith("EntrySessionAnalysis", {
    journalId: "journal-test-entry",
    sessionAnalysis: expect.objectContaining({
      analysis: "A short read on this entry.",
    }),
  });
});

test("still saves when the inline session analysis fails", async () => {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: "ios",
  });
  ReactTestRenderer.act(() => {
    setPremiumSession(true);
  });
  (getJournalSessionAnalysis as jest.Mock).mockRejectedValueOnce(
    new Error("Analysis unavailable")
  );

  const root = await renderScreen({ onBack: jest.fn() });
  await typeContent(root, "The entry must survive a failed analysis.");
  await saveThroughConfirmSheet(root);

  expect(createJournalEntry).toHaveBeenCalledTimes(1);
  expect(extractText(root.toJSON())).not.toContain("Analysis unavailable");
  expect(navigateMainApp).toHaveBeenCalledWith("EntrySessionAnalysis", {
    journalId: "journal-test-entry",
    sessionAnalysis: undefined,
  });
});

test("routes free iOS entries to the obscured analysis without requesting it", async () => {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: "ios",
  });
  ReactTestRenderer.act(() => {
    setPremiumSession(false);
  });

  const root = await renderScreen({ onBack: jest.fn() });
  await typeContent(
    root,
    "A free entry that should keep the iOS analysis beat."
  );
  await saveThroughConfirmSheet(root);

  expect(getJournalSessionAnalysis).not.toHaveBeenCalled();
  expect(navigateMainApp).toHaveBeenCalledWith("EntrySessionAnalysis", {
    journalId: "journal-test-entry",
    sessionAnalysis: undefined,
  });
});

test("returns Android entries Home without analysis or goals navigation", async () => {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: "android",
  });
  ReactTestRenderer.act(() => {
    setPremiumSession(true);
  });

  const root = await renderScreen({ onBack: jest.fn() });
  await typeContent(root, "An Android entry returns directly to Home.");
  await saveThroughConfirmSheet(root);

  expect(getJournalSessionAnalysis).not.toHaveBeenCalled();
  expect(navigateMainApp).not.toHaveBeenCalled();
  expect(useAppStore.getState().stage).toBe("main-app");
  expect(useAppStore.getState().activeTab).toBe("home");
});

test("preserves the draft and waits to save until connectivity returns", async () => {
  const root = await renderScreen({ onBack: jest.fn() });

  await typeContent(root, "Keep this thought while offline");

  await ReactTestRenderer.act(async () => {
    reportBackendUnavailable();
  });

  expect(
    root.root.findByProps({ accessibilityLabel: "Save entry" }).props.disabled
  ).toBe(true);

  await ReactTestRenderer.act(async () => {
    root.root.findByProps({ accessibilityLabel: "Save entry" }).props.onPress();
  });

  expect(createJournalEntry).not.toHaveBeenCalled();
  expect(
    root.root.findByProps({ accessibilityLabel: "Entry content" }).props.value
  ).toBe("Keep this thought while offline");

  await ReactTestRenderer.act(async () => {
    reportBackendReachable();
  });

  expect(
    root.root.findByProps({ accessibilityLabel: "Save entry" }).props.disabled
  ).toBe(false);

  await saveThroughConfirmSheet(root);

  expect(createJournalEntry).toHaveBeenCalledWith(
    expect.objectContaining({
      content: "Keep this thought while offline",
      type: "open_ended",
    })
  );
});

test("saves blank titles as untitled entries instead of a generated date title", async () => {
  const root = await renderScreen({ onBack: jest.fn() });

  await typeContent(root, "Left the title blank on purpose");
  await saveThroughConfirmSheet(root);

  expect(createJournalEntry).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Untitled",
      content: "Left the title blank on purpose",
      type: "open_ended",
    })
  );
  expect(cancelWeeklyInsightNotifications).toHaveBeenCalledTimes(1);
  expect(createJournalEntry).not.toHaveBeenCalledWith(
    expect.objectContaining({
      title: expect.stringMatching(/^Entry for /),
    })
  );
});

test("falls back to local prompts when the prompt request fails", async () => {
  (getWritingPrompts as jest.Mock).mockRejectedValueOnce(
    new Error("Prompts unavailable")
  );

  const root = await renderScreen({ onBack: jest.fn() });

  // The composer has to stay usable offline, so a failed fetch is silent.
  expect(extractText(root.toJSON())).not.toContain("Prompts unavailable");
  expect(
    root.root.findByProps({
      accessibilityLabel:
        "Add writing prompt to your entry: What felt steady today?",
    })
  ).toBeTruthy();
});

test("keeps the entry screen open when saving fails", async () => {
  const onBack = jest.fn();
  (createJournalEntry as jest.Mock).mockRejectedValueOnce(
    new Error("Server unavailable")
  );

  const root = await renderScreen({ onBack });

  await typeContent(root, "Persistence should fail here");
  await saveThroughConfirmSheet(root);

  expect(extractText(root.toJSON())).toContain("Server unavailable");
  expect(onBack).not.toHaveBeenCalled();
});
