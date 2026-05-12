/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LifetimeOfferPaywallScreen from "../src/screens/profile/LifetimeOfferPaywallScreen";
import { resetAppStore, useAppStore } from "../src/store/appStore";
import {
  getRevenueCatOfferings,
  getRevenueCatPaywallPlans,
  purchaseRevenueCatPackage,
} from "../src/services/revenueCatService";
import {
  getPaywallConfig,
  syncPaywallPurchase,
  trackPaywallEvent,
} from "../src/services/paywallService";
import { ThemeProvider } from "../src/theme/provider";

jest.mock("../src/services/revenueCatService", () => ({
  getRevenueCatActiveEntitlement: jest.fn(() => ({
    identifier: "Journal.IO Pro",
    isActive: true,
    store: "TEST_STORE",
  })),
  getRevenueCatConfigurationError: jest.fn(() => null),
  getRevenueCatOfferings: jest.fn(async () => ({ current: null, all: {} })),
  getRevenueCatPaywallPlans: jest.fn(() => [
    {
      id: "lifetime",
      title: "LIFETIME",
      durationLabel: "$149.99",
      price: "$149.99",
      subtitle: "One-time unlock",
      highlight: "87 of 100 claimed",
      badge: "One time offer",
      planKey: "lifetime",
      revenueCatOfferingId: "journalio_offering_lifetime_dev",
      revenueCatPackageId: "$rc_lifetime",
      rcPackage: {
        identifier: "$rc_lifetime",
        packageType: "LIFETIME",
        product: {
          identifier: "journalio.lifetime",
          priceString: "$149.99",
          pricePerMonthString: null,
          title: "Lifetime Premium",
        },
      },
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
            productIdentifier: "journalio.lifetime",
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
  restoreRevenueCatPurchases: jest.fn(async () => ({
    entitlements: {
      active: {
        "Journal.IO Pro": {
          identifier: "Journal.IO Pro",
          isActive: true,
          store: "TEST_STORE",
          productIdentifier: "journalio.lifetime",
        },
      },
    },
  })),
}));

jest.mock("../src/services/paywallService", () => ({
  getPaywallConfig: jest.fn(async () => ({
    shouldShow: true,
    placementKey: "profile_upgrade_banner",
    screenKey: "profile",
    triggerMode: "contextual",
    wasInterruptive: false,
    reason: "ready",
    template: {
      key: "lifetime-launch",
      title: "Lifetime Offer",
      headline: "A one-time unlock for the first 100 Journal.IO members.",
      subheadline: "Reserve lifetime premium access while the launch offer is still available.",
      heroBadgeLabel: "Lifetime access",
      purchaseChipTitle: "One-time",
      purchaseChipBody: "No renewal",
      featureCarouselTitle: "What lifetime unlocks",
      socialProofLine: "Be one of the first users to be part of this family.",
      footerLegal: "One-time purchase. Premium stays on this account after sync.",
      featureList: [],
      primaryOfferingKey: "lifetime",
      secondaryOfferingKeys: [],
      visibleOfferingKeys: ["lifetime"],
    },
    offerings: [
      {
        key: "lifetime",
        title: "LIFETIME",
        price: "$149.99",
        priceSuffix: "one-time",
        subtitle: "One-time unlock",
        badge: "One time offer",
        highlight: "First 100 users",
        sortOrder: 5,
        revenueCatOfferingId: "journalio_offering_lifetime_dev",
        revenueCatPackageId: "$rc_lifetime",
        purchasedUsersCount: 87,
        purchaseLimit: 100,
      },
    ],
  })),
  syncPaywallPurchase: jest.fn(async () => ({
    userId: "user-test",
    name: "Test User",
    phoneNumber: null,
    email: "test@example.com",
    isPremium: true,
    premiumPlanKey: "lifetime",
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

describe("LifetimeOfferPaywallScreen", () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    ReactTestRenderer.act(() => {
      resetAppStore();
      useAppStore.setState({
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

  it("renders the Make lifetime offer copy", async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider modeOverride="dark">
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>
            <LifetimeOfferPaywallScreen onBack={jest.fn()} />
          </SafeAreaProvider>
        </ThemeProvider>
      );
      await flushPromises();
    });

    const text = extractText(renderer!.toJSON());

    expect(text).toContain("Go Premium. Forever.");
    expect(text).toContain(
      "One payment. No subscriptions. No renewals. Yours for life."
    );
    expect(text).toContain("Unlimited AI insights & personalised prompts");
    expect(text).toContain("Advanced analytics & emotion tracking");
    expect(text).toContain("Securely export all your entries");
    expect(text).toContain("$149.99");
    expect(text).toContain("87/100 claimed");
    expect(text).toContain("Unlock Lifetime Premium");
    expect(text).toContain("30-day money back guarantee");
    expect(text).toContain("Restore");
  });

  it("uses the manual RevenueCat purchase flow for lifetime access", async () => {
    const onBack = jest.fn();

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider modeOverride="dark">
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>
            <LifetimeOfferPaywallScreen onBack={onBack} />
          </SafeAreaProvider>
        </ThemeProvider>
      );
      await flushPromises();
    });

    await ReactTestRenderer.act(async () => {
      renderer!.root
        .findByProps({ accessibilityLabel: "Unlock Lifetime Premium" })
        .props.onPress();
      await flushPromises();
    });

    expect(purchaseRevenueCatPackage).toHaveBeenCalledTimes(1);
    expect(syncPaywallPurchase).toHaveBeenCalledTimes(1);
    expect(getPaywallConfig).toHaveBeenCalledTimes(1);
    expect(getRevenueCatOfferings).toHaveBeenCalledTimes(1);
    expect(getRevenueCatPaywallPlans).toHaveBeenCalledTimes(1);
    expect(trackPaywallEvent).toHaveBeenCalled();
    expect(extractText(renderer!.toJSON())).toContain(
      "Lifetime access is active."
    );
  });

  it("uses the active app theme instead of a hardcoded dark palette", async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider modeOverride="light">
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>
            <LifetimeOfferPaywallScreen onBack={jest.fn()} />
          </SafeAreaProvider>
        </ThemeProvider>
      );
      await flushPromises();
    });

    const matchingViews = renderer!.root.findAll(node => {
      const style = StyleSheet.flatten(node.props.style);
      return style?.backgroundColor === "#FDFCFB";
    });

    expect(matchingViews.length).toBeGreaterThan(0);
  });

  it("shows a blocking loader while lifetime offer data is still loading", async () => {
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider modeOverride="dark">
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>
            <LifetimeOfferPaywallScreen onBack={jest.fn()} />
          </SafeAreaProvider>
        </ThemeProvider>
      );
    });

    const loadingText = extractText(renderer!.toJSON());

    expect(loadingText).toContain("Loading lifetime offer...");
    expect(loadingText).toContain(
      "Fetching current pricing and claim availability."
    );

    await ReactTestRenderer.act(async () => {
      await flushPromises();
    });
  });
});
