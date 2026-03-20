/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HomeScreen from "../src/screens/HomeScreen";

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

test("renders the home screen layout", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <HomeScreen userName="Journal User" onToggleTheme={jest.fn()} />
      </SafeAreaProvider>
    );
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(tree).toContain("Current Streak");
  expect(tree).toContain("Capture a quick thought...");
  expect(tree).toContain("AI Insight");
  expect(tree).toContain("Today's Prompt");
  expect(tree).toContain("Recent Entries");
  expect(tree).toContain("No entries yet");
  expect(tree).toContain("Home");
  expect(tree).toContain("Calendar");
  expect(tree).toContain("New");
  expect(tree).toContain("Insights");
  expect(tree).toContain("Profile");
});
