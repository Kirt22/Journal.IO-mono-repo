/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import JournalEntryCard from "../src/components/JournalEntryCard";
import { triggerHaptic } from "../src/services/hapticsService";
import { resetAppStore, useAppStore } from "../src/store/appStore";
import { ThemeProvider } from "../src/theme/provider";

jest.mock("../src/services/hapticsService", () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

let root: ReactTestRenderer.ReactTestRenderer | null = null;

const entry = {
  _id: "entry-1",
  title: "Morning Reflections",
  content: "Started the day with a calm walk.",
  type: "open_ended",
  entryKind: "journal" as const,
  tags: ["gratitude", "morning"],
  createdAt: "2026-03-30T08:00:00.000Z",
  updatedAt: "2026-03-30T08:00:00.000Z",
  isFavorite: false,
};

beforeEach(() => {
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
  jest.mocked(triggerHaptic).mockClear();
});

afterEach(() => {
  ReactTestRenderer.act(() => {
    root?.unmount();
    root = null;
    resetAppStore();
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
  expect(triggerHaptic).toHaveBeenCalledWith("primaryAction");
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

test("uses the open-ended journal artwork regardless of mood tags", () => {
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

  expect(root!.root.findByProps({ testID: "entry-type-icon-open-ended" })).toBeTruthy();
  expect(JSON.stringify(root!.toJSON())).not.toContain("😊");
});

test("uses the supplied guided-reflection artwork", () => {
  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard
          entry={{
            ...entry,
            type: "guided",
          }}
        />
      </ThemeProvider>
    );
  });

  expect(root!.root.findByProps({ testID: "entry-type-icon-guided" })).toBeTruthy();
});

test("uses the current placeholder icon for persisted and legacy Quick Thoughts", () => {
  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard
          entry={{
            ...entry,
            entryKind: "quick_thought",
            title: "Renamed thought",
          }}
        />
      </ThemeProvider>
    );
  });

  expect(
    root!.root.findByProps({ testID: "entry-type-icon-quick-thought" })
  ).toBeTruthy();
  // The quill PNG replaced the lucide glyph, so the other entry types are no
  // longer the only ones drawn from an asset.
  expect(JSON.stringify(root!.toJSON())).toContain("quill-pen.png");
  expect(JSON.stringify(root!.toJSON())).toContain("Quick Thought");

  ReactTestRenderer.act(() => {
    root?.update(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard
          entry={{
            ...entry,
            entryKind: undefined,
            title: "Quick Thought",
          }}
        />
      </ThemeProvider>
    );
  });

  expect(
    root!.root.findByProps({ testID: "entry-type-icon-quick-thought" })
  ).toBeTruthy();
});

test("shows detected topics instead of raw journal metadata tags", () => {
  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard
          entry={{
            ...entry,
            tags: ["onboarding:first-reflection", "legacy-user-tag"],
            detectedTopics: [
              "anxiety",
              "loneliness",
              "self-care",
              "confidence",
            ],
          }}
        />
      </ThemeProvider>
    );
  });

  const tree = JSON.stringify(root!.toJSON());
  expect(tree).toContain("Anxiety");
  expect(tree).toContain("Loneliness");
  expect(tree).toContain("Self Care");
  expect(tree).not.toContain("Confidence");
  expect(tree).not.toContain("legacy-user-tag");
  expect(tree).not.toContain("onboarding:first-reflection");
});

test("keeps non-internal Quick Note tags", () => {
  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard
          entry={{
            ...entry,
            entryKind: "quick_thought",
            tags: ["idea", "mood:good", "onboarding:first-reflection"],
            detectedTopics: ["anxiety"],
          }}
        />
      </ThemeProvider>
    );
  });

  const tree = JSON.stringify(root!.toJSON());
  expect(tree).toContain("Idea");
  expect(tree).not.toContain("Anxiety");
  expect(tree).not.toContain("mood:good");
  expect(tree).not.toContain("onboarding:first-reflection");
});

test("exposes favorite and delete controls when card actions are open", async () => {
  const onFavoritePress = jest.fn(async () => undefined);
  const onDeletePress = jest.fn();

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard
          actionsOpen
          enableEntryActions
          entry={entry}
          onDeletePress={onDeletePress}
          onFavoritePress={onFavoritePress}
        />
      </ThemeProvider>
    );
  });

  await ReactTestRenderer.act(async () => {
    await root!.root.findByProps({ accessibilityLabel: "Favorite entry" }).props.onPress();
  });
  ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityLabel: "Delete entry" }).props.onPress();
  });

  expect(onFavoritePress).toHaveBeenCalledWith(true);
  expect(onDeletePress).toHaveBeenCalledTimes(1);
  expect(triggerHaptic).toHaveBeenNthCalledWith(1, "primaryAction");
  expect(triggerHaptic).toHaveBeenNthCalledWith(2, "secondaryAction");
});

test("fills the rounded gap beside the open favorite action", async () => {
  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard
          actionsOpen
          enableEntryActions
          entry={entry}
          onDeletePress={jest.fn()}
          onFavoritePress={jest.fn()}
        />
      </ThemeProvider>
    );
  });

  const seam = root!.root.findByProps({ testID: "journal-entry-action-seam" });
  const favoriteButton = root!.root.findByProps({ accessibilityLabel: "Favorite entry" });
  const seamStyle = seam.props.style.find((style: { backgroundColor?: string }) =>
    Boolean(style?.backgroundColor)
  );
  const favoriteStyle = favoriteButton.props
    .style({ pressed: false })
    .find((style: { backgroundColor?: string }) => Boolean(style?.backgroundColor));

  expect(seam.props.pointerEvents).toBe("none");
  expect(seam.props.accessible).toBe(false);
  expect(seamStyle.backgroundColor).toBe(favoriteStyle.backgroundColor);
});

test("opening an entry card emits navigation haptic feedback", () => {
  const onPress = jest.fn();

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard entry={entry} onPress={onPress} />
      </ThemeProvider>
    );
  });

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: "Open entry Morning Reflections" })
      .props.onPress();
  });

  expect(onPress).toHaveBeenCalledTimes(1);
  expect(triggerHaptic).toHaveBeenCalledWith("screenTransition");
});

test("double tap favorites once and shows the large-star celebration", () => {
  const onFavoritePress = jest.fn(async () => undefined);
  const onPress = jest.fn();

  jest.useFakeTimers();

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard
          enableEntryActions
          entry={entry}
          onDeletePress={jest.fn()}
          onFavoritePress={onFavoritePress}
          onPress={onPress}
        />
      </ThemeProvider>
    );
  });

  const cardButton = root!.root.findByProps({
    accessibilityLabel: "Open entry Morning Reflections",
  });

  ReactTestRenderer.act(() => {
    cardButton.props.onPress();
    cardButton.props.onPress();
  });

  expect(onFavoritePress).toHaveBeenCalledTimes(1);
  expect(onFavoritePress).toHaveBeenCalledWith(true);
  expect(triggerHaptic).toHaveBeenCalledWith("primaryAction");
  expect(onPress).not.toHaveBeenCalled();
  expect(root!.root.findByProps({ testID: "favorite-celebration-star" })).toBeTruthy();
});

test("single tap waits for the double-tap window before opening an entry", () => {
  const onPress = jest.fn();

  jest.useFakeTimers();

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard
          enableEntryActions
          entry={entry}
          onDeletePress={jest.fn()}
          onFavoritePress={jest.fn()}
          onPress={onPress}
        />
      </ThemeProvider>
    );
  });

  const cardButton = root!.root.findByProps({
    accessibilityLabel: "Open entry Morning Reflections",
  });

  ReactTestRenderer.act(() => {
    cardButton.props.onPress();
  });
  expect(onPress).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(300);
  });

  expect(onPress).toHaveBeenCalledTimes(1);
  expect(triggerHaptic).toHaveBeenCalledWith("screenTransition");
});

test("double tap on an existing favorite pulses without changing it", () => {
  const onFavoritePress = jest.fn();

  jest.useFakeTimers();

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalEntryCard
          enableEntryActions
          entry={{ ...entry, isFavorite: true }}
          onDeletePress={jest.fn()}
          onFavoritePress={onFavoritePress}
          onPress={jest.fn()}
        />
      </ThemeProvider>
    );
  });

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: "Open entry Morning Reflections" })
      .props.onPress();
    root!.root
      .findByProps({ accessibilityLabel: "Open entry Morning Reflections" })
      .props.onPress();
  });

  expect(onFavoritePress).not.toHaveBeenCalled();
  expect(triggerHaptic).toHaveBeenCalledWith("primaryAction");
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
