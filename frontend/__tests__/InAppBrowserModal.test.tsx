/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import InAppBrowserModal from "../src/components/InAppBrowserModal";
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

beforeEach(() => {
  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.setState({
      legalBrowserUrl: "https://api.journalio.app/privacy",
      legalBrowserTitle: "Privacy Policy",
    });
  });
});

afterEach(() => {
  resetAppStore();
});

test("renders the in-app browser and closes it from the header", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <InAppBrowserModal />
      </SafeAreaProvider>
    );
  });

  expect(
    root!.root.findByProps({ accessibilityLabel: "Close browser" })
  ).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    root!.root.findByProps({ accessibilityLabel: "Close browser" }).props.onPress();
  });

  expect(useAppStore.getState().legalBrowserUrl).toBeNull();
  expect(useAppStore.getState().legalBrowserTitle).toBeNull();
});
