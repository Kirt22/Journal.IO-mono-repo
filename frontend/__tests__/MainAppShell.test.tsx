/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import {
  BACK_SWIPE_SCREEN_OPTIONS,
  NewEntryRoute,
} from "../src/screens/main/MainAppShell";
import { resetAppStore, useAppStore } from "../src/store/appStore";

const mockNewEntryScreen = jest.fn((_props: unknown) => null);

jest.mock("../src/screens/NewEntryScreen", () => ({
  __esModule: true,
  default: (props: unknown) => mockNewEntryScreen(props),
}));

beforeEach(() => {
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
  mockNewEntryScreen.mockClear();
});

test("enables swipe-back behavior on pushed main app screens", () => {
  expect(BACK_SWIPE_SCREEN_OPTIONS).toMatchObject({
    gestureEnabled: true,
    animation: "slide_from_right",
    animationMatchesGesture: true,
  });
});

test("uses the app-store close flow when backing out of New Entry", () => {
  const closeNewEntry = jest.fn();

  useAppStore.setState({
    closeNewEntry,
    pendingNewEntryPrompt: "Reflect on what felt heavy today.",
  });

  ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<NewEntryRoute />);
  });

  expect(mockNewEntryScreen).toHaveBeenCalledWith(
    expect.objectContaining({
      initialPrompt: "Reflect on what felt heavy today.",
      onBack: closeNewEntry,
    })
  );
});
