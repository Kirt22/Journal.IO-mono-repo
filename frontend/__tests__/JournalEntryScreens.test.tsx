/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import EntryDetailScreen from "../src/screens/journal/EntryDetailScreen";
import EditEntryScreen from "../src/screens/journal/EditEntryScreen";
import { resetAppStore, useAppStore } from "../src/store/appStore";

jest.mock("../src/services/journalService", () => ({
  deleteJournalEntry: jest.fn().mockResolvedValue({}),
  getJournalEntries: jest.fn().mockResolvedValue([]),
  getJournalEntry: jest.fn().mockResolvedValue({
    _id: "mar-15",
    title: "Morning Reflections",
    content: "Started the day with a beautiful sunrise walk.",
    type: "journal",
    aiPrompt: "What are you grateful for today?",
    images: [],
    tags: ["gratitude", "morning", "nature"],
    isFavorite: true,
    createdAt: "2026-03-15T08:00:00.000Z",
    updatedAt: "2026-03-15T08:00:00.000Z",
  }),
  getJournalQuickAnalysis: jest.fn().mockResolvedValue({
    journalId: "mar-15",
    summary: {
      headline: "Morning carried this steady moment",
      narrative:
        "This entry reads like a grounded check-in. The language suggests the morning routine was doing real emotional work here.",
      highlight:
        "Morning looks like the clearest thread to keep tracking if you want to understand what steadies you.",
    },
    scorecard: {
      vibeLabel: "Steadier moment",
      vibeTone: "sage",
      cards: [
        { key: "words", label: "Words", value: "7", tone: "blue" },
        { key: "mood", label: "Mood", value: "Good", tone: "sage" },
        { key: "focus", label: "Focus", value: "Morning", tone: "amber" },
        { key: "depth", label: "Depth", value: "Quick note", tone: "amber" },
      ],
    },
    patternTags: [
      { label: "Morning", tone: "amber" },
      { label: "Gratitude", tone: "sage" },
    ],
    signals: {
      whatStoodOut: {
        title: "Morning was the clearest signal",
        description:
          "The entry makes it pretty clear that the start of the day shaped the emotional tone more than anything else.",
        evidence: ["Morning", "Good"],
        tone: "amber",
      },
      whatNeedsCare: {
        title: "Nothing sharp looked overwhelming",
        description:
          "There is no major friction point here, which makes this a useful entry for noticing what is already working.",
        evidence: ["Good", "Quick note"],
        tone: "blue",
      },
      whatToCarryForward: {
        title: "This is worth carrying forward",
        description:
          "The steadier tone itself is useful data. It helps show what a more regulated moment sounds like on the page.",
        evidence: ["Quick note", "Morning"],
        tone: "sage",
      },
    },
    nextStep: {
      title: "Name what made the morning work",
      description:
        "Next time, add one line about what made this feel steady so you can spot the pattern faster.",
      focus: "Support",
    },
    generatedAt: "2026-03-15T08:10:00.000Z",
  }),
  updateJournalEntry: jest.fn(async payload => ({
    _id: payload.journalId,
    title: payload.title,
    content: payload.content,
    type: payload.type || "journal",
    aiPrompt: payload.aiPrompt ?? "What are you grateful for today?",
    images: payload.images || [],
    tags: payload.tags || [],
    isFavorite: payload.isFavorite ?? false,
    createdAt: "2026-03-15T08:00:00.000Z",
    updatedAt: "2026-03-30T08:00:00.000Z",
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

test("entry detail opens the journal editor", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.getState().openJournalEntry("mar-15");
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <EntryDetailScreen />
      </SafeAreaProvider>
    );
    await Promise.resolve();
  });

  const editButton = root!.root.findByProps({
    accessibilityLabel: "Edit entry",
  });

  ReactTestRenderer.act(() => {
    editButton.props.onPress();
  });

  expect(useAppStore.getState().stage).toBe("journal-edit");
});

test("entry detail renders the refreshed quick analysis card", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.setState({
      session: {
        accessToken: "test-access",
        refreshToken: "test-refresh",
        user: {
          userId: "user-test",
          name: "Journal User",
          phoneNumber: null,
          email: "journal@example.com",
          isPremium: true,
          journalingGoals: [],
          avatarColor: null,
          profileSetupCompleted: true,
          onboardingCompleted: true,
          profilePic: null,
          aiOptIn: true,
        },
      },
    });
    useAppStore.getState().openJournalEntry("mar-15");
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <EntryDetailScreen />
      </SafeAreaProvider>
    );
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    await root!.root
      .findByProps({ accessibilityLabel: "Generate quick analysis" })
      .props.onPress();
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(tree).toContain("Morning carried this steady moment");
  expect(tree).toContain("Steadier moment");
  expect(tree).toContain("What Stood Out");
  expect(tree).toContain("What Needs Care");
  expect(tree).toContain("What To Carry Forward");
  expect(tree).toContain("Name what made the morning work");
});

test("edit entry saves changes and returns to detail", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.getState().openJournalEditor("mar-15");
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <EditEntryScreen />
      </SafeAreaProvider>
    );
    await Promise.resolve();
  });

  ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityLabel: "Entry title" }).props.onChangeText("Updated reflections");
    root!.root.findByProps({ accessibilityLabel: "Entry content" }).props.onChangeText("Updated content for the day.");
  });

  await ReactTestRenderer.act(async () => {
    await root!.root.findByProps({ accessibilityLabel: "Save entry" }).props.onPress();
  });

  expect(useAppStore.getState().stage).toBe("journal-detail");
  expect(useAppStore.getState().recentJournalEntries[0].title).toBe(
    "Updated reflections"
  );
});
