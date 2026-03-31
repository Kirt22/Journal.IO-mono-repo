/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NewEntryScreen from "../src/screens/NewEntryScreen";
import { createJournalEntry } from "../src/services/journalService";

jest.mock("../src/services/journalService", () => ({
  createJournalEntry: jest.fn(async payload => ({
    _id: "journal-test-entry",
    title: payload.title,
    content: payload.content,
    type: payload.type || "journal",
    images: [],
    tags: payload.tags || [],
    isFavorite: false,
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
    await root!.root.findByProps({ accessibilityLabel: "Save entry" }).props.onPress();
  });

  expect(createJournalEntry).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Afternoon note",
      content: "A calm reset after a busy meeting",
      type: "journal",
    })
  );
  expect(onBack).toHaveBeenCalled();
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
