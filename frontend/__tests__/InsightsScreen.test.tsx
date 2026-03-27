/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import InsightsScreen from "../src/screens/InsightsScreen";

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

test("renders the insights screen with overview and ai analysis sections", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <InsightsScreen />
      </SafeAreaProvider>
    );
  });

  const tree = extractText(root!.toJSON());

  expect(tree).toContain("Insights");
  expect(tree).toContain("Overview");
  expect(tree).toContain("Total Entries");
  expect(tree).toContain("Current Streak");
  expect(tree).toContain("7-Day Activity");
  expect(tree).toContain("Your writing frequency");
  expect(tree).toContain("Mood Distribution");
  expect(tree).toContain("Amazing");
  expect(tree).toContain("Good");
  expect(tree).toContain("Okay");
  expect(tree).toContain("Popular Topics");
  expect(tree).toContain("Morning routines");
  expect(tree).toContain("Work stress");
  expect(tree).toContain("Relationships");
  expect(tree).toContain("Sleep & energy");
  expect(tree).toContain("Gratitude");

  await ReactTestRenderer.act(() => {
    root!.root.findByProps({ testID: "activity-point-0" }).props.onPress();
  });

  const updatedOverviewTree = extractText(root!.toJSON());

  expect(updatedOverviewTree).toContain("Fri");
  expect(updatedOverviewTree).toContain("1 journaling sessions");

  await ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityLabel: "AI Analysis" }).props.onPress();
  });

  const analysisTree = extractText(root!.toJSON());

  expect(analysisTree).toContain("This Week's Summary");
  expect(analysisTree).toContain("Key Insight");
  expect(analysisTree).toContain("Growth Patterns");
  expect(analysisTree).toContain("Emotional Awareness");
  expect(analysisTree).toContain("Gratitude Practice");
  expect(analysisTree).toContain("Nature & Reflection");
  expect(analysisTree).toContain("Personalized Prompts");
  expect(analysisTree).toContain("Suggested topic");
  expect(analysisTree).toContain("What felt most steady or grounding in your day?");

  await ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityLabel: "Overview" }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root!.root.findByProps({ testID: "breakdown-segment-1" }).props.onPress();
  });

  const updatedPieTree = extractText(root!.toJSON());

  expect(updatedPieTree).toContain("Mood Distribution");
  expect(updatedPieTree).toContain("Good");
  expect(updatedPieTree).toContain("34%");
  expect(updatedPieTree).toContain("Top 5 topics used in recent journal entries");
});
