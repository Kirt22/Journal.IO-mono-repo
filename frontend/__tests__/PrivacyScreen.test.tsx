/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import PrivacyScreen from "../src/screens/profile/PrivacyScreen";
import { LEGAL_URLS, openExternalUrl } from "../src/utils/legalLinks";
import { resetAppStore, useAppStore } from "../src/store/appStore";

jest.mock("../src/utils/legalLinks", () => ({
  LEGAL_URLS: {
    privacyPolicy: "https://api.journalio.app/privacy",
    termsOfService: "https://api.journalio.app/terms",
    privacyChoices: "https://api.journalio.app/privacy-choices",
    accountDeletion: "https://api.journalio.app/account-deletion",
    supportEmail: "mailto:support@journalio.app",
  },
  SUPPORT_EMAIL: "support@journalio.app",
  openExternalUrl: jest.fn(async () => undefined),
}));

jest.mock("../src/services/privacyService", () => ({
  deleteAccount: jest.fn(async () => ({
    deletedAccount: true,
  })),
  exportAllEntries: jest.fn(async () => ({})),
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

beforeEach(() => {
  ReactTestRenderer.act(() => {
    resetAppStore();
    jest.clearAllMocks();

    useAppStore.setState({
      session: {
        accessToken: "test-access",
        refreshToken: "test-refresh",
        user: {
          userId: "user-test",
          name: "Journal User",
          phoneNumber: null,
          email: "journal@example.com",
          isPremium: true,
          journalingGoals: [],
          avatarColor: null,
          profileSetupCompleted: true,
          onboardingCompleted: true,
          profilePic: null,
          aiOptIn: true,
        },
      },
    });
  });
});

test("opens hosted legal pages from the privacy screen", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <PrivacyScreen
          onBack={jest.fn()}
          onOpenExportPaywall={jest.fn()}
          onSignOut={jest.fn()}
        />
      </SafeAreaProvider>
    );
  });

  await ReactTestRenderer.act(async () => {
    await findPressableByLabel(root!, "Read Full Privacy Policy").props.onPress();
    await findPressableByLabel(root!, "Read Terms of Service").props.onPress();
    await findPressableByLabel(root!, "Privacy Choices & Deletion").props.onPress();
  });

  expect(openExternalUrl).toHaveBeenNthCalledWith(
    1,
    LEGAL_URLS.privacyPolicy,
    "Privacy Policy"
  );
  expect(openExternalUrl).toHaveBeenNthCalledWith(
    2,
    LEGAL_URLS.termsOfService,
    "Terms of Service"
  );
  expect(openExternalUrl).toHaveBeenNthCalledWith(
    3,
    LEGAL_URLS.privacyChoices,
    "Privacy Choices"
  );
});

test("opens the support mail link from the privacy screen", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <PrivacyScreen
          onBack={jest.fn()}
          onOpenExportPaywall={jest.fn()}
          onSignOut={jest.fn()}
        />
      </SafeAreaProvider>
    );
  });

  await ReactTestRenderer.act(async () => {
    await findPressableByLabel(root!, "Contact Support").props.onPress();
  });

  expect(openExternalUrl).toHaveBeenCalledWith(
    LEGAL_URLS.supportEmail,
    "Support"
  );
});
