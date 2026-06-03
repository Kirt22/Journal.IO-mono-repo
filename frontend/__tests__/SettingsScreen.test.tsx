/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SettingsScreen from "../src/screens/profile/SettingsScreen";
import { deleteAccount, updateAiOptOutPreference } from "../src/services/privacyService";
import { resetAppStore, useAppStore } from "../src/store/appStore";

jest.mock("../src/services/privacyService", () => ({
  deleteAccount: jest.fn(async () => ({
    deletedAccount: true,
  })),
  updateAiOptOutPreference: jest.fn(async () => ({
    aiOptIn: false,
  })),
}));

jest.mock("../src/services/paywallService", () => ({
  trackPaywallEvent: jest.fn(async () => undefined),
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

function findPressableByLabel(
  root: ReactTestRenderer.ReactTestRenderer,
  label: string
) {
  const matches = root.root.findAll(
    node =>
      typeof node.props?.onPress === "function" &&
      extractText(node).includes(label)
  );

  if (!matches.length) {
    throw new Error(`Unable to find pressable with label: ${label}`);
  }

  return matches[0];
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
          onOpenPrivacyModePaywall={onOpenPaywall}
          onOpenHidePreviewsPaywall={onOpenPaywall}
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

test("initiates account deletion directly from settings", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onSignOut = jest.fn(async () => undefined);
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

  ReactTestRenderer.act(() => {
    setSession(false);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SettingsScreen
          onBack={jest.fn()}
          onOpenPrivacy={jest.fn()}
          onOpenPrivacyModePaywall={jest.fn()}
          onOpenHidePreviewsPaywall={jest.fn()}
          onSignOut={onSignOut}
          currentThemePreference="system"
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
  });

  ReactTestRenderer.act(() => {
    findPressableByLabel(root!, "Delete Account").props.onPress();
  });

  expect(alertSpy.mock.calls[0]?.[1]).toContain(
    "This permanently deletes your Journal.IO account"
  );
  expect(alertSpy.mock.calls[0]?.[1]).not.toContain(
    "does not cancel an active App Store subscription"
  );

  const destructiveAction = alertSpy.mock.calls[0]?.[2]?.find(
    action => action.style === "destructive"
  );

  await ReactTestRenderer.act(async () => {
    await destructiveAction?.onPress?.();
  });

  expect(deleteAccount).toHaveBeenCalledTimes(1);
  expect(onSignOut).toHaveBeenCalledTimes(1);

  alertSpy.mockRestore();
});

test("explains subscription management before premium account deletion from settings", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

  ReactTestRenderer.act(() => {
    setSession(true);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SettingsScreen
          onBack={jest.fn()}
          onOpenPrivacy={jest.fn()}
          onOpenPrivacyModePaywall={jest.fn()}
          onOpenHidePreviewsPaywall={jest.fn()}
          onSignOut={jest.fn()}
          currentThemePreference="system"
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>
    );
  });

  ReactTestRenderer.act(() => {
    findPressableByLabel(root!, "Delete Account").props.onPress();
  });

  const actions = alertSpy.mock.calls[0]?.[2] ?? [];

  expect(alertSpy.mock.calls[0]?.[1]).toContain(
    "Deleting your account does not cancel an active App Store subscription."
  );
  expect(actions.map(action => action.text)).toEqual([
    "Cancel",
    "Manage Subscription",
    "Delete Account",
  ]);

  alertSpy.mockRestore();
});
