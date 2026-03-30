/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import JournalEntryCard from "../src/components/JournalEntryCard";
import { ThemeProvider } from "../src/theme/provider";

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

test("favorite star is clickable on the journal card", () => {
  const onFavoritePress = jest.fn();
  let root: ReactTestRenderer.ReactTestRenderer;

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
