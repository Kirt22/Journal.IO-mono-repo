/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OnboardingScreen } from "../src/screens/onboarding/OnboardingScreen";

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

test("renders the onboarding flow and advances to the next step", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <OnboardingScreen isCompleting={false} onContinue={jest.fn()} />
      </SafeAreaProvider>
    );
  });

  const tree = extractText(root!.toJSON());

  expect(tree).toContain("Welcome to Journal.IO");
  expect(tree).toContain("Step 1 of 8");
  expect(tree).toContain("Continue");

  await ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityRole: "button" }).props.onPress();
  });

  const nextTree = extractText(root!.toJSON());

  expect(nextTree).toContain("How old are you?");
  expect(nextTree).toContain("Step 2 of 8");
});
