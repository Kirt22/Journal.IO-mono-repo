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
    images: [],
    tags: ["gratitude", "morning", "nature"],
    isFavorite: true,
    createdAt: "2026-03-15T08:00:00.000Z",
    updatedAt: "2026-03-15T08:00:00.000Z",
  }),
  updateJournalEntry: jest.fn(async payload => ({
    _id: payload.journalId,
    title: payload.title,
    content: payload.content,
    type: payload.type || "journal",
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
