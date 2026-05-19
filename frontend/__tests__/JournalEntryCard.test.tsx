/**
 * @format
 */

import React from "react";
import { Platform } from "react-native";
import ReactTestRenderer from "react-test-renderer";
import JournalEntryCard from "../src/components/JournalEntryCard";
import { resetAppStore, useAppStore } from "../src/store/appStore";
import { ThemeProvider } from "../src/theme/provider";

let root: ReactTestRenderer.ReactTestRenderer | null = null;
const originalOS = Platform.OS;
const testPlatform = Platform as typeof Platform & { isPad?: boolean };
const originalIsPad = testPlatform.isPad;

const entry = {
  _id: "entry-1",
  title: "Morning Reflections",
  content: "Started the day with a calm walk.",
  type: "journal",
  tags: ["gratitude", "morning"],
  createdAt: "2026-03-30T08:00:00.000Z",
  updatedAt: "2026-03-30T08:00:00.000Z",
  isFavorite: false,
};

beforeEach(() => {
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
});

afterEach(() => {
  ReactTestRenderer.act(() => {
    root?.unmount();
    root = null;
    resetAppStore();
  });

  Object.defineProperty(testPlatform, "isPad", {
    configurable: true,
    value: originalIsPad,
  });
  Object.defineProperty(testPlatform, "OS", {
    configurable: true,
    value: originalOS,
  });
  jest.useRealTimers();
});

test("favorite star is clickable on the journal card", () => {
  const onFavoritePress = jest.fn();

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard entry={entry} onFavoritePress={onFavoritePress} />
      </ThemeProvider>
    );
  });

  const favoriteButton = root!.root.findByProps({
    accessibilityLabel: "Add favorite",
  });

  ReactTestRenderer.act(() => {
    favoriteButton.props.onPress({
      stopPropagation: jest.fn(),
    });
  });

  expect(onFavoritePress).toHaveBeenCalledTimes(1);
});

test("renders a date fallback for untitled journal entries", () => {
  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard
          entry={{
            ...entry,
            title: "Untitled",
          }}
        />
      </ThemeProvider>
    );
  });

  expect(JSON.stringify(root!.toJSON())).toContain("Entry for Mar 30 2026");
  expect(JSON.stringify(root!.toJSON())).not.toContain("Untitled");
});

test("uses vector markers instead of native emoji text for entry visuals", () => {
  jest.useFakeTimers();
  Object.defineProperty(testPlatform, "OS", {
    configurable: true,
    value: "ios",
  });
  Object.defineProperty(testPlatform, "isPad", {
    configurable: true,
    value: true,
  });

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard
          entry={{
            ...entry,
            tags: ["mood:good", "gratitude"],
          }}
        />
      </ThemeProvider>
    );
  });

  const rendered = JSON.stringify(root!.toJSON());

  expect(rendered).toContain("Morning Reflections");
  expect(rendered).toContain("😊");

  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(180);
  });

  const fallbackRendered = JSON.stringify(root!.toJSON());

  expect(fallbackRendered).toContain("Morning Reflections");
  expect(fallbackRendered).not.toContain("😊");

  jest.useRealTimers();
});

test("keeps native emoji text for entry visuals outside iPad fallback", () => {
  Object.defineProperty(testPlatform, "OS", {
    configurable: true,
    value: "ios",
  });
  Object.defineProperty(testPlatform, "isPad", {
    configurable: true,
    value: false,
  });

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard
          entry={{
            ...entry,
            tags: ["mood:good", "gratitude"],
          }}
        />
      </ThemeProvider>
    );
  });

  const rendered = JSON.stringify(root!.toJSON());

  expect(rendered).toContain("Morning Reflections");
  expect(rendered).toContain("😊");
});

test("masks journal previews when the device privacy setting is enabled", () => {
  ReactTestRenderer.act(() => {
    useAppStore.setState({ hideJournalPreviews: true });
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard entry={entry} />
      </ThemeProvider>
    );
  });

  const rendered = JSON.stringify(root!.toJSON());

  expect(rendered).toContain("Journal Entry");
  expect(rendered).toContain("Preview hidden. Open the entry to read it.");
  expect(rendered).not.toContain("Morning Reflections");
  expect(rendered).not.toContain("Started the day with a calm walk.");
  expect(rendered).not.toContain("gratitude");
});
