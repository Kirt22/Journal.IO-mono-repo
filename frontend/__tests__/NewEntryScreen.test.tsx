/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NewEntryScreen from "../src/screens/NewEntryScreen";

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

test("renders the new entry screen and validates empty content", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onBack = jest.fn();

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <NewEntryScreen onBack={onBack} />
      </SafeAreaProvider>
    );
  });

  const tree = extractText(root!.toJSON());

  expect(tree).toContain("New Entry");
  expect(tree).toContain("Show Writing Prompts");
  expect(tree).toContain("Auto-tag with AI");
  expect(tree).toContain("Tags");

  await ReactTestRenderer.act(() => {
    const saveButton = root!.root.findByProps({
      accessibilityLabel: "Save entry",
    });
    saveButton.props.onPress();
  });

  const errorTree = extractText(root!.toJSON());

  expect(errorTree).toContain("Please write something before saving.");

  const backButton = root!.root.findByProps({ accessibilityLabel: "Back" });

  ReactTestRenderer.act(() => {
    backButton.props.onPress();
  });

  expect(onBack).toHaveBeenCalled();
});
