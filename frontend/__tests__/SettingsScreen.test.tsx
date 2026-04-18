/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SettingsScreen from "../src/screens/profile/SettingsScreen";
import { updateAiOptOutPreference } from "../src/services/privacyService";
import { resetAppStore, useAppStore } from "../src/store/appStore";

jest.mock("../src/services/privacyService", () => ({
  updateAiOptOutPreference: jest.fn(async () => ({
    aiOptIn: false,
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

const setSession = (isPremium: boolean) => {
  useAppStore.setState({
    session: {
      accessToken: "test-access",
      refreshToken: "test-refresh",
      user: {
        userId: "user-test",
        name: "Journal User",
        phoneNumber: null,
        email: "journal@example.com",
        isPremium,
        journalingGoals: [],
        avatarColor: null,
        profileSetupCompleted: true,
        onboardingCompleted: true,
        profilePic: null,
        aiOptIn: true,
      },
    },
  });
};

beforeEach(() => {
  resetAppStore();
  jest.clearAllMocks();
});

test("locks premium privacy controls for free users", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onOpenPaywall = jest.fn();

  ReactTestRenderer.act(() => {
    setSession(false);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SettingsScreen
          onBack={jest.fn()}
          onOpenPrivacy={jest.fn()}
          onOpenPaywall={onOpenPaywall}
          onSignOut={jest.fn()}
          currentThemePreference="system"
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
  });

  expect(extractText(root!.toJSON())).toContain(
    "Premium unlocks Privacy Mode for AI reflections and weekly analysis."
  );

  ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityLabel: "Unlock Privacy Mode" }).props.onPress();
    root!.root
      .findByProps({ accessibilityLabel: "Unlock Hide Journal Previews" })
      .props.onPress();
  });

  expect(onOpenPaywall).toHaveBeenCalledTimes(2);
  expect(updateAiOptOutPreference).not.toHaveBeenCalled();
});
