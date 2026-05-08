/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SetupProfileScreen from "../src/screens/profile/SetupProfileScreen";

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

test("does not render a back action on post-auth profile setup", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SetupProfileScreen
          authEmail="alex@example.com"
          authSource="email"
          onboardingContext={null}
          initialName="Alex"
          onComplete={jest.fn(async () => undefined)}
          onSkip={jest.fn(async () => undefined)}
        />
      </SafeAreaProvider>
    );
  });

  const treeText = extractText(root!.toJSON());

  expect(treeText).toContain("Set up your profile");
  expect(treeText).not.toContain("Back");
});

test("shows Apple as the connected auth provider", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SetupProfileScreen
          authEmail="alex@example.com"
          authSource="apple"
          onboardingContext={null}
          initialName="Alex"
          onComplete={jest.fn(async () => undefined)}
          onSkip={jest.fn(async () => undefined)}
        />
      </SafeAreaProvider>
    );
  });

  const treeText = extractText(root!.toJSON());

  expect(treeText).toContain("Apple connected");
});
