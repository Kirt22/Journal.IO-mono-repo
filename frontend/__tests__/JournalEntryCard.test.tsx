/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import JournalEntryCard from "../src/components/JournalEntryCard";
import { resetAppStore, useAppStore } from "../src/store/appStore";
import { ThemeProvider } from "../src/theme/provider";

let root: ReactTestRenderer.ReactTestRenderer | null = null;

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
