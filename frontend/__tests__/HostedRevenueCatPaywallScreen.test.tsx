/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HostedRevenueCatPaywallScreen from "../src/screens/profile/HostedRevenueCatPaywallScreen";
import { resetAppStore, useAppStore } from "../src/store/appStore";
import { hasRevenueCatHostedPaywall } from "../src/services/revenueCatService";
import {
  getPaywallConfig,
  trackPaywallEvent,
} from "../src/services/paywallService";

jest.mock("react-native-purchases-ui", () => ({
  __esModule: true,
  PAYWALL_RESULT: {
    NOT_PRESENTED: "NOT_PRESENTED",
    ERROR: "ERROR",
    CANCELLED: "CANCELLED",
    PURCHASED: "PURCHASED",
    RESTORED: "RESTORED",
  },
  default: {
    Paywall: jest.fn(() => null),
    presentPaywall: jest.fn(),
  },
}));

jest.mock("../src/services/revenueCatService", () => ({
  findRevenueCatPackageByProductIdentifier: jest.fn(() => null),
  getRevenueCatActiveEntitlement: jest.fn(() => null),
  getRevenueCatHostedOffering: jest.fn(async () => ({
    offering: {
      identifier: "journalio_offering_post_onboarding_standard_dev",
      serverDescription: "Post onboarding main offering",
      metadata: {},
      availablePackages: [
        {
          identifier: "$rc_annual",
          packageType: "ANNUAL",
          product: {
            priceString: "$59.99",
            pricePerMonthString: "$5.00",
            title: "Yearly Premium",
          },
        },
      ],
      annual: {
        identifier: "$rc_annual",
        packageType: "ANNUAL",
        product: {
          priceString: "$59.99",
          pricePerMonthString: "$5.00",
          title: "Yearly Premium",
        },
      },
      weekly: null,
      monthly: null,
      twoMonth: null,
      threeMonth: null,
      sixMonth: null,
      lifetime: null,
      webCheckoutUrl: null,
    },
    offerings: {
      current: null,
      all: {},
    },
  })),
  hasPremiumAccess: jest.fn(() => false),
  hasRevenueCatHostedPaywall: jest.fn(() => true),
  refreshRevenueCatEntitlementState: jest.fn(async () => ({
    customerInfo: null,
    activeEntitlement: null,
    hasPremiumAccess: false,
  })),
}));

jest.mock("../src/services/paywallService", () => ({
  getPaywallConfig: jest.fn(async () => ({
    shouldShow: true,
    placementKey: "post_auth",
    screenKey: "verify-email",
    triggerMode: "contextual",
    wasInterruptive: false,
    reason: "eligible",
    template: {
      key: "post-auth-trial",
      title: "Premium",
      headline: "Unlock Premium",
      subheadline: null,
      heroBadgeLabel: null,
      purchaseChipTitle: null,
      purchaseChipBody: null,
      featureCarouselTitle: null,
      socialProofLine: null,
      footerLegal: null,
      featureList: [],
      primaryOfferingKey: "yearly",
      secondaryOfferingKeys: ["weekly"],
      visibleOfferingKeys: ["yearly", "weekly"],
    },
    offerings: [
      {
        key: "yearly",
        title: "YEARLY",
        price: "$59.99",
        priceSuffix: "/year",
        subtitle: null,
        badge: null,
        highlight: null,
        sortOrder: 1,
        revenueCatOfferingId: "journalio_offering_post_onboarding_standard_dev",
        revenueCatPackageId: "$rc_annual",
        purchasedUsersCount: 0,
        purchaseLimit: null,
      },
    ],
  })),
  syncPaywallPurchase: jest.fn(),
  trackPaywallEvent: jest.fn(async () => ({
    eventId: "event-test",
    createdAt: "2026-04-23T00:00:00.000Z",
  })),
}));

jest.mock("../src/services/reminderNotificationsService", () => ({
  cancelFreeTrialEndingReminder: jest.fn(async () => undefined),
  scheduleFreeTrialEndingReminder: jest.fn(async () => undefined),
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

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
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

describe("HostedRevenueCatPaywallScreen", () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    ReactTestRenderer.act(() => {
      resetAppStore();
      useAppStore.setState({
        stage: "hosted-paywall",
        activeHostedPaywallTarget: "main",
        activePaywallPlacementKey: "post_auth",
        activePaywallScreenKey: "verify-email",
        activePaywallTriggerMode: "contextual",
        pendingPostAuthDiscountOffer: true,
        paywallReturnStage: "profile",
        session: {
          accessToken: "test-access",
          refreshToken: "test-refresh",
          user: {
            userId: "user-test",
            name: "Test User",
            phoneNumber: null,
            email: "test@example.com",
            isPremium: false,
            premiumPlanKey: null,
            premiumActivatedAt: null,
            journalingGoals: [],
            avatarColor: "#8E4636",
            profileSetupCompleted: true,
            onboardingCompleted: true,
            profilePic: null,
            aiOptIn: true,
          },
        },
      });
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    ReactTestRenderer.act(() => {
      renderer?.unmount();
      renderer = null;
      resetAppStore();
    });
  });

  it("launches a hosted paywall once even after wrapper state updates", async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={safeAreaMetrics}>
          <HostedRevenueCatPaywallScreen />
        </SafeAreaProvider>
      );

      await flushPromises();
    });

    expect(hasRevenueCatHostedPaywall).toHaveBeenCalledTimes(1);
    expect(getPaywallConfig).toHaveBeenCalledTimes(1);
    expect(trackPaywallEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "paywall_impression",
      })
    );
    expect(useAppStore.getState().stage).toBe("hosted-paywall");

    const { default: RevenueCatUI } = require("react-native-purchases-ui");
    expect(RevenueCatUI.Paywall).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(async () => {
      RevenueCatUI.Paywall.mock.calls[0][0].onPurchaseStarted({
        packageBeingPurchased: {
          identifier: "$rc_annual",
        },
      });
      await flushPromises();
    });

    expect(trackPaywallEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "cta_tap",
        metadata: expect.objectContaining({
          action: "purchase",
        }),
      })
    );
    expect(extractText(renderer?.toJSON())).toContain("Processing your purchase...");
  });
});
