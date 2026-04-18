/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SubscriptionScreen from "../src/screens/profile/SubscriptionScreen";
import { useAppStore, resetAppStore } from "../src/store/appStore";
import {
  getRevenueCatCustomerInfo,
  restoreRevenueCatPurchases,
} from "../src/services/revenueCatService";

jest.mock("../src/services/revenueCatService", () => ({
  getRevenueCatActiveEntitlement: jest.fn(customerInfo =>
    customerInfo?.entitlements?.active?.["Journal.IO Pro"] ?? null
  ),
  getRevenueCatConfigurationError: jest.fn(() => null),
  getRevenueCatCustomerInfo: jest.fn(async () => ({
    entitlements: {
      active: {
        "Journal.IO Pro": {
          identifier: "Journal.IO Pro",
          isActive: true,
          store: "APP_STORE",
        },
      },
    },
  })),
  hasRevenueCatPremiumAccess: jest.fn(customerInfo =>
    Boolean(customerInfo?.entitlements?.active?.["Journal.IO Pro"]?.isActive)
  ),
  restoreRevenueCatPurchases: jest.fn(async () => ({
    entitlements: {
      active: {
        "Journal.IO Pro": {
          identifier: "Journal.IO Pro",
          isActive: true,
          store: "APP_STORE",
        },
      },
    },
  })),
}));

jest.mock("../src/services/paywallService", () => ({
  syncPaywallPurchase: jest.fn(async () => ({
    userId: "user-test",
    name: "Premium User",
    phoneNumber: null,
    email: "premium@example.com",
    isPremium: true,
    premiumPlanKey: "weekly",
    premiumActivatedAt: "2026-04-16T09:30:00.000Z",
    journalingGoals: [],
    avatarColor: null,
    profileSetupCompleted: true,
    onboardingCompleted: true,
    profilePic: null,
    aiOptIn: true,
  })),
}));

jest.mock("../src/services/reminderNotificationsService", () => ({
  cancelFreeTrialEndingReminder: jest.fn(async () => undefined),
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

beforeEach(() => {
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
  jest.clearAllMocks();

  ReactTestRenderer.act(() => {
    useAppStore.setState({
      session: {
        accessToken: "test-access",
        refreshToken: "test-refresh",
        user: {
          userId: "user-test",
          name: "Premium User",
          phoneNumber: null,
          email: "premium@example.com",
          isPremium: true,
          premiumPlanKey: "weekly",
          premiumActivatedAt: "2026-04-16T09:30:00.000Z",
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

test("shows member-facing details for renewable premium plans", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SubscriptionScreen onBack={jest.fn()} currentPlanKey="weekly" />
      </SafeAreaProvider>
    );
    await Promise.resolve();
  });

  expect(getRevenueCatCustomerInfo).toHaveBeenCalledWith("user-test");
  expect(extractText(root!.toJSON())).toContain("Weekly Premium");
  expect(extractText(root!.toJSON())).toContain(
    "Your weekly membership is active."
  );
  expect(extractText(root!.toJSON())).toContain("Manage Subscription");
  expect(extractText(root!.toJSON())).toContain("Membership already active");
  expect(extractText(root!.toJSON())).not.toContain("RevenueCat");
});

test("shows non-recurring messaging for lifetime members", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SubscriptionScreen onBack={jest.fn()} currentPlanKey="lifetime" />
      </SafeAreaProvider>
    );
    await Promise.resolve();
  });

  expect(extractText(root!.toJSON())).toContain("Lifetime Premium");
  expect(extractText(root!.toJSON())).toContain("No recurring subscription");
  expect(extractText(root!.toJSON())).not.toContain("Manage renewal or billing");
  expect(restoreRevenueCatPurchases).not.toHaveBeenCalled();
});
