/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import DiscountOfferPaywallScreen from "../src/screens/profile/DiscountOfferPaywallScreen";
import { resetAppStore, useAppStore } from "../src/store/appStore";
import { purchaseRevenueCatPackage } from "../src/services/revenueCatService";
import { syncPaywallPurchase } from "../src/services/paywallService";
import { ThemeProvider } from "../src/theme/provider";

const mockAnnualPackage = {
  identifier: "$rc_annual_exit",
  packageType: "ANNUAL",
  product: {
    identifier: "journalio.yearly.exit",
    priceString: "$29.99",
    pricePerMonthString: "$2.50",
    title: "Exit Yearly Premium",
  },
};

jest.mock("../src/services/revenueCatService", () => ({
  getRevenueCatActiveEntitlement: jest.fn(() => ({
    identifier: "Journal.IO Pro",
    isActive: true,
    store: "TEST_STORE",
    productIdentifier: "journalio.yearly.exit",
  })),
  getRevenueCatConfigurationError: jest.fn(() => null),
  getRevenueCatOfferings: jest.fn(async () => ({
    current: null,
    all: {
      journalio_offering_post_onboarding_standard_dev: {
        identifier: "journalio_offering_post_onboarding_standard_dev",
        availablePackages: [mockAnnualPackage],
      },
    },
  })),
  getRevenueCatPackagesForPlanKey: jest.fn(() => [mockAnnualPackage]),
  getRevenueCatPaywallPlans: jest.fn(() => [
    {
      id: "yearly_exit_offer",
      title: "YEARLY",
      durationLabel: "$29.99",
      price: "$29.99/year",
      subtitle: "Most value",
      highlight: "50% off",
      badge: "Limited time",
      planKey: "annual",
      revenueCatOfferingId: "journalio_offering_post_onboarding_exit_dev",
      revenueCatPackageId: null,
      rcPackage: null,
      introOffer: null,
    },
  ]),
  hasPremiumAccess: jest.fn(() => true),
  purchaseRevenueCatPackage: jest.fn(async () => ({
    customerInfo: {
      entitlements: {
        active: {
          "Journal.IO Pro": {
            identifier: "Journal.IO Pro",
            isActive: true,
            store: "TEST_STORE",
            productIdentifier: "journalio.yearly.exit",
          },
        },
      },
    },
  })),
  refreshRevenueCatEntitlementState: jest.fn(async () => ({
    customerInfo: null,
    activeEntitlement: null,
    hasPremiumAccess: false,
  })),
  restoreRevenueCatPurchases: jest.fn(),
}));

jest.mock("../src/services/paywallService", () => ({
  getPaywallConfig: jest.fn(async () => ({
    shouldShow: true,
    placementKey: "post_auth_exit_offer",
    screenKey: "verify-email",
    triggerMode: "contextual",
    wasInterruptive: false,
    reason: "ready",
    template: {
      key: "exit-offer",
      title: "Exit offer",
      headline: "Wait! Don't go.",
      subheadline: null,
      heroBadgeLabel: null,
      purchaseChipTitle: null,
      purchaseChipBody: null,
      featureCarouselTitle: null,
      socialProofLine: null,
      footerLegal: null,
      featureList: [],
      primaryOfferingKey: "yearly_exit_offer",
      secondaryOfferingKeys: [],
      visibleOfferingKeys: ["yearly_exit_offer"],
    },
    offerings: [
      {
        key: "yearly_exit_offer",
        title: "YEARLY",
        price: "$29.99",
        priceSuffix: "/year",
        subtitle: null,
        badge: "Limited time",
        highlight: "50% off",
        sortOrder: 1,
        revenueCatOfferingId: "journalio_offering_post_onboarding_exit_dev",
        revenueCatPackageId: null,
        purchasedUsersCount: 0,
        purchaseLimit: null,
      },
    ],
  })),
  syncPaywallPurchase: jest.fn(async () => ({
    userId: "user-test",
    name: "Test User",
    phoneNumber: null,
    email: "test@example.com",
    isPremium: true,
    premiumPlanKey: "yearly_exit_offer",
    premiumActivatedAt: "2026-04-23T00:00:00.000Z",
    journalingGoals: [],
    avatarColor: "#8E4636",
    profileSetupCompleted: true,
    onboardingCompleted: true,
    profilePic: null,
    aiOptIn: true,
  })),
  trackPaywallEvent: jest.fn(async () => ({
    eventId: "event-test",
    createdAt: "2026-04-23T00:00:00.000Z",
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

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const getInstanceText = (
  node: ReactTestRenderer.ReactTestInstance | string | number
): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  return node.children
    .map(child =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : getInstanceText(child)
    )
    .join("");
};

describe("DiscountOfferPaywallScreen", () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    ReactTestRenderer.act(() => {
      resetAppStore();
      useAppStore.setState({
        activePaywallScreenKey: "verify-email",
        session: {
          accessToken: "access",
          refreshToken: "refresh",
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

  it("uses a live annual fallback package when the exit-offer plan has no attached package", async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider modeOverride="light">
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>
            <DiscountOfferPaywallScreen onBack={jest.fn()} />
          </SafeAreaProvider>
        </ThemeProvider>
      );
      await flushPromises();
    });

    const claimButton = renderer!.root
      .findAllByProps({ accessibilityRole: "button" })
      .find(node => getInstanceText(node).includes("Claim 50% Off"));

    expect(claimButton).toBeDefined();
    expect(claimButton?.props.disabled).toBe(false);

    await ReactTestRenderer.act(async () => {
      claimButton!.props.onPress();
      await flushPromises();
    });

    expect(purchaseRevenueCatPackage).toHaveBeenCalledWith(
      mockAnnualPackage,
      "user-test"
    );
    expect(syncPaywallPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        offeringKey: "yearly_exit_offer",
        revenueCatPackageId: "$rc_annual_exit",
        store: "TEST_STORE",
      })
    );
    expect(getInstanceText(renderer!.root)).toContain("You're Premium");
    expect(getInstanceText(renderer!.root)).toContain(
      "Your premium access is ready. You can continue into Journal.IO."
    );
  });
});
