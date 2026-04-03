/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import CalendarScreen from "../src/screens/calendar/CalendarScreen";
import { calendarSampleJournalEntries } from "../src/models/calendarModels";
import { resetAppStore, useAppStore } from "../src/store/appStore";

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

const formatCalendarDateLabel = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

test("renders the calendar screen layout", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.getState().setRecentJournalEntries(calendarSampleJournalEntries);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <CalendarScreen />
      </SafeAreaProvider>
    );
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(tree).toContain("Calendar");
  expect(tree).toContain("Total");
  expect(tree).toContain("This Month");
  expect(tree).toContain("Favorites");
  expect(tree).toContain("Morning Reflections");
  expect(tree).toContain("Challenging Day at Work");

  await ReactTestRenderer.act(() => {
    root!.root
      .findAllByProps({ accessibilityLabel: "Switch to calendar view" })[0]
      .props.onPress();
  });

  const calendarTree = JSON.stringify(root!.toJSON());

  expect(calendarTree).toContain("April 2026");
  expect(calendarTree).toContain("S");
  expect(calendarTree).toContain("M");
  expect(calendarTree).toContain("T");
  expect(calendarTree).toContain("W");
  expect(calendarTree).toContain("F");

  await ReactTestRenderer.act(() => {
    root!.root
      .findAllByProps({ accessibilityLabel: "Previous month" })[0]
      .props.onPress();
  });

  const previousMonthTree = JSON.stringify(root!.toJSON());

  expect(previousMonthTree).toContain("March 2026");

  await ReactTestRenderer.act(() => {
    root!.root
      .findAllByProps({ accessibilityLabel: "Select Sun, Mar 15, 2026" })[0]
      .props.onPress();
  });

  const selectedTree = JSON.stringify(root!.toJSON());

  expect(selectedTree).toContain("Mar 15, 2026");
  expect(selectedTree).toContain("Morning Reflections");
});

test("shows a create-entry placeholder when there are no calendar entries", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <CalendarScreen />
      </SafeAreaProvider>
    );
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(tree).toContain("No entries yet");
  expect(tree).toContain("Start your journaling journey by creating your first entry");
  expect(root!.root.findByProps({ accessibilityLabel: "Create a new entry" })).toBeTruthy();

  await ReactTestRenderer.act(() => {
    root!.root
      .findAllByProps({ accessibilityLabel: "Switch to calendar view" })[0]
      .props.onPress();
  });

  const calendarTree = JSON.stringify(root!.toJSON());

  expect(calendarTree).toContain(formatCalendarDateLabel(new Date()));
  expect(calendarTree).toContain("No entries for this date");
});

test("loads today's entries immediately when opening calendar view", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const today = new Date();
  const todayEntry = {
    _id: "today-entry",
    title: "Today entry",
    content: "Today journal content",
    type: "journal",
    images: [],
    tags: ["today"],
    isFavorite: false,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  };

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.getState().setRecentJournalEntries([todayEntry]);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <CalendarScreen />
      </SafeAreaProvider>
    );
  });

  await ReactTestRenderer.act(() => {
    root!.root
      .findAllByProps({ accessibilityLabel: "Switch to calendar view" })[0]
      .props.onPress();
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(tree).toContain(formatCalendarDateLabel(today));
  expect(tree).toContain("Today entry");
});

test("opens a journal detail from the calendar entry card", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.getState().setRecentJournalEntries(calendarSampleJournalEntries);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <CalendarScreen />
      </SafeAreaProvider>
    );
  });

  const firstEntryCard = root!.root.findAllByProps({
    accessibilityLabel: "Open entry Morning Reflections",
  })[0];

  expect(firstEntryCard).toBeTruthy();

  ReactTestRenderer.act(() => {
    firstEntryCard.props.onPress();
  });

  expect(useAppStore.getState().stage).toBe("journal-detail");
  expect(useAppStore.getState().selectedJournalEntryId).toBe("mar-15");
});
