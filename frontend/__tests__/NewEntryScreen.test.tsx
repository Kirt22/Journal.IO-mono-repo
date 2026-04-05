/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NewEntryScreen from "../src/screens/NewEntryScreen";
import {
  createJournalEntry,
  suggestJournalTags,
} from "../src/services/journalService";
import { getWritingPrompts } from "../src/services/promptsService";
import { resetAppStore, useAppStore } from "../src/store/appStore";

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
  suggestJournalTags: jest.fn(async () => ({
    tags: ["reflection", "growth"],
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

jest.mock("../src/services/remindersService", () => ({
  getPrimaryDailyReminder: jest.fn(async () => null),
}));

jest.mock("../src/services/reminderNotificationsService", () => ({
  syncReminderNotifications: jest.fn(async () => undefined),
}));

beforeEach(() => {
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
  (createJournalEntry as jest.Mock).mockClear();
  (suggestJournalTags as jest.Mock).mockClear();
  (getWritingPrompts as jest.Mock).mockClear();
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
        aiOptIn: true,
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

test("renders the new entry screen and validates empty content", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onBack = jest.fn();

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <NewEntryScreen onBack={onBack} />
      </SafeAreaProvider>
    );
  });

  const tree = extractText(root!.toJSON());

  expect(tree).toContain("New Entry");
  expect(tree).toContain("Show Writing Prompts");
  expect(tree).toContain("Auto-tag with AI");
  expect(tree).toContain("Tags");

  await ReactTestRenderer.act(() => {
    const saveButton = root!.root.findByProps({
      accessibilityLabel: "Save entry",
    });
    saveButton.props.onPress();
  });

  const errorTree = extractText(root!.toJSON());

  expect(errorTree).toContain("Please write something before saving.");

  const backButton = root!.root.findByProps({ accessibilityLabel: "Back" });

  ReactTestRenderer.act(() => {
    backButton.props.onPress();
  });

  expect(onBack).toHaveBeenCalled();
});

test("saves an entry and returns to home", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onBack = jest.fn();

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <NewEntryScreen onBack={onBack} />
      </SafeAreaProvider>
    );
  });

  await ReactTestRenderer.act(async () => {
    root!.root
      .findByProps({ accessibilityLabel: "Entry title" })
      .props.onChangeText("Afternoon note");

    root!.root
      .findByProps({ accessibilityLabel: "Entry content" })
      .props.onChangeText("A calm reset after a busy meeting");

    root!.root.findByProps({ accessibilityLabel: "Good" }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    root!.root.findByProps({ accessibilityLabel: "Show writing prompts" }).props.onPress();
  });

  expect(getWritingPrompts).toHaveBeenCalledTimes(1);

  await ReactTestRenderer.act(async () => {
    root!.root.findByProps({ accessibilityLabel: "What are you grateful for today?" }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await root!.root.findByProps({ accessibilityLabel: "Save entry" }).props.onPress();
  });

  expect(createJournalEntry).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Afternoon note",
      content: expect.stringMatching(
        /A calm reset after a busy meeting[\s\S]*What are you grateful for today\?/
      ),
      type: "journal",
      aiPrompt: "What are you grateful for today?",
    })
  );
  expect(onBack).toHaveBeenCalled();
});

test("saves blank titles as untitled entries instead of a generated date title", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <NewEntryScreen onBack={jest.fn()} />
      </SafeAreaProvider>
    );
  });

  await ReactTestRenderer.act(async () => {
    root!.root
      .findByProps({ accessibilityLabel: "Entry content" })
      .props.onChangeText("Left the title blank on purpose");
  });

  await ReactTestRenderer.act(async () => {
    root!.root.findByProps({ accessibilityLabel: "Show writing prompts" }).props.onPress();
  });

  expect(getWritingPrompts).toHaveBeenCalledTimes(1);

  await ReactTestRenderer.act(async () => {
    root!.root.findByProps({ accessibilityLabel: "What are you grateful for today?" }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await root!.root.findByProps({ accessibilityLabel: "Save entry" }).props.onPress();
  });

  expect(createJournalEntry).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Untitled",
      content: expect.stringMatching(
        /Left the title blank on purpose[\s\S]*What are you grateful for today\?/
      ),
      type: "journal",
      aiPrompt: "What are you grateful for today?",
    })
  );
  expect(createJournalEntry).not.toHaveBeenCalledWith(
    expect.objectContaining({
      title: expect.stringMatching(/^Entry for /),
    })
  );
});

test("keeps the entry screen open when saving fails", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onBack = jest.fn();

  (createJournalEntry as jest.Mock).mockRejectedValueOnce(
    new Error("Server unavailable")
  );

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <NewEntryScreen onBack={onBack} />
      </SafeAreaProvider>
    );
  });

  await ReactTestRenderer.act(async () => {
    root!.root
      .findByProps({ accessibilityLabel: "Entry content" })
      .props.onChangeText("Persistence should fail here");

    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    await root!.root.findByProps({ accessibilityLabel: "Save entry" }).props.onPress();
  });

  const errorTree = extractText(root!.toJSON());

  expect(errorTree).toContain("Server unavailable");
  expect(onBack).not.toHaveBeenCalled();
});

test("loads backend-backed auto tag suggestions into the suggestions card", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <NewEntryScreen onBack={jest.fn()} />
      </SafeAreaProvider>
    );
  });

  await ReactTestRenderer.act(async () => {
    root!.root
      .findByProps({ accessibilityLabel: "Entry content" })
      .props.onChangeText("I learned a lot from a difficult meeting today.");
  });

  await ReactTestRenderer.act(async () => {
    root!.root.findByProps({ accessibilityLabel: "Bad" }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await root!.root.findByProps({ accessibilityLabel: "Auto-tag with AI" }).props.onPress();
  });

  expect(suggestJournalTags).toHaveBeenCalledWith({
    content: "I learned a lot from a difficult meeting today.",
    selectedTags: [],
    mood: "bad",
  });

  const tree = extractText(root!.toJSON());
  expect(tree).toContain("AI Suggested Tags");
  expect(tree).toContain("reflection");
  expect(tree).toContain("growth");
});

test("locks AI auto-tagging for non-premium users and does not call the API", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    setPremiumSession(false);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <NewEntryScreen onBack={jest.fn()} />
      </SafeAreaProvider>
    );
  });

  await ReactTestRenderer.act(async () => {
    root!.root
      .findByProps({ accessibilityLabel: "Entry content" })
      .props.onChangeText("This entry should not trigger AI tags on free access.");
  });

  await ReactTestRenderer.act(async () => {
    await root!.root.findByProps({ accessibilityLabel: "Auto-tag with AI" }).props.onPress();
  });

  expect(suggestJournalTags).not.toHaveBeenCalled();
  expect(extractText(root!.toJSON())).toContain(
    "Premium membership is required for AI tag suggestions."
  );
});

test("prefills the entry content when opened from a selected home prompt", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <NewEntryScreen
          onBack={jest.fn()}
          initialPrompt="What felt most steady or grounding in your day?"
        />
      </SafeAreaProvider>
    );
  });

  const contentInput = root!.root.findByProps({ accessibilityLabel: "Entry content" });
  expect(contentInput.props.value).toContain(
    "What felt most steady or grounding in your day?"
  );
});
