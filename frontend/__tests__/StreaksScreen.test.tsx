/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import StreaksScreen from "../src/screens/StreaksScreen";
import {
  getCurrentStreakSummary,
  getStreakHistory,
} from "../src/services/streaksService";

jest.mock("../src/services/streaksService", () => ({
  getCurrentStreakSummary: jest.fn(async () => ({
    currentStreak: 9,
    bestStreak: 14,
    thisMonthEntries: 8,
    totalEntries: 52,
    achievements: [
      {
        key: "first-entry",
        title: "First Entry",
        description: "Started your journey",
        unlocked: true,
      },
      {
        key: "7-day-streak",
        title: "7-Day Streak",
        description: "Wrote for a week",
        unlocked: true,
      },
      {
        key: "30-day-streak",
        title: "30-Day Streak",
        description: "A month of consistency",
        unlocked: false,
      },
      {
        key: "50-entries",
        title: "50 Entries",
        description: "Prolific writer",
        unlocked: true,
      },
      {
        key: "100-entries",
        title: "100 Entries",
        description: "Century club",
        unlocked: false,
      },
    ],
  })),
  getStreakHistory: jest.fn(async () => ({
    days: Array.from({ length: 30 }, (_, index) => ({
      dateKey: `2026-04-${String(index + 1).padStart(2, "0")}`,
      count: index % 4 === 0 ? 1 : 0,
      hasEntry: index % 4 === 0,
      isToday: index === 29,
    })),
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

async function waitForText(
  renderer: ReactTestRenderer.ReactTestRenderer,
  expectedText: string
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (extractText(renderer.toJSON()).includes(expectedText)) {
      return;
    }

    await ReactTestRenderer.act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
}

test("renders streak metrics, activity, and achievements from the API", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <StreaksScreen />
      </SafeAreaProvider>
    );

    await Promise.resolve();
    await Promise.resolve();
  });

  await waitForText(root!, "Streaks & Habits");

  const tree = extractText(root!.toJSON());

  expect(getCurrentStreakSummary).toHaveBeenCalledTimes(1);
  expect(getStreakHistory).toHaveBeenCalledWith(30);
  expect(tree).toContain("Current Streak");
  expect(tree).toContain("9");
  expect(tree).toContain("Best Streak");
  expect(tree).toContain("14");
  expect(tree).toContain("This Month");
  expect(tree).toContain("8");
  expect(tree).toContain("Total");
  expect(tree).toContain("52");
  expect(tree).toContain("30-Day Activity");
  expect(tree).toContain("Achievements");
  expect(tree).toContain("First Entry");
  expect(tree).toContain("50 Entries");
  expect(root!.root.findAllByProps({ accessibilityLabel: "Apr 30, 2026" }).length).toBeGreaterThan(0);
});
