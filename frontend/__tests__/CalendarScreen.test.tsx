/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import CalendarScreen from "../src/screens/calendar/CalendarScreen";

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

test("renders the calendar screen layout", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

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

  expect(calendarTree).toContain("March 2026");
  expect(calendarTree).toContain("S");
  expect(calendarTree).toContain("M");
  expect(calendarTree).toContain("T");
  expect(calendarTree).toContain("W");
  expect(calendarTree).toContain("F");

  await ReactTestRenderer.act(() => {
    root!.root
      .findAllByProps({ accessibilityLabel: "Select Sun, Mar 15, 2026" })[0]
      .props.onPress();
  });

  const selectedTree = JSON.stringify(root!.toJSON());

  expect(selectedTree).toContain("Mar 15, 2026");
  expect(selectedTree).toContain("Morning Reflections");
});
