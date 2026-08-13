/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import PaywallScreen from "../src/screens/profile/PaywallScreen";
import { PREMIUM_FEATURES } from "../src/screens/profile/paywallContent";
import { resetAppStore, useAppStore } from "../src/store/appStore";
import { ThemeProvider } from "../src/theme/provider";

jest.mock("../src/services/hapticsService", () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

jest.mock("../src/services/reminderNotificationsService", () => ({
  cancelFreeTrialEndingReminder: jest.fn(async () => undefined),
  scheduleFreeTrialEndingReminder: jest.fn(async () => undefined),
}));

jest.mock("../src/services/revenueCatService", () => ({
  getRevenueCatActiveEntitlement: jest.fn(() => null),
  getRevenueCatConfigurationError: jest.fn(() => null),
  getRevenueCatOfferings: jest.fn(async () => ({ current: null, all: {} })),
  getRevenueCatPurchaseAttribution: jest.fn(() => null),
  getRevenueCatPaywallPlans: jest.fn(() => [
    {
      id: "yearly",
      title: "Yearly",
      durationLabel: "Yearly",
      price: "$39.99",
      periodLabel: "per year",
      subtitle: "billed annually",
      badge: "Best value",
      planKey: "annual",
      offeringKey: "yearly",
      revenueCatOfferingId: "journalio_offering_other_screens_standard",
      revenueCatPackageId: "$rc_annual",
      rcPackage: { identifier: "$rc_annual", product: { identifier: "app.journalio.premium.yearly" } },
      introOffer: { isFreeTrial: true, durationLabel: "7-day", price: "$0.00" },
    },
    {
      id: "weekly",
      title: "Weekly",
      durationLabel: "Weekly",
      price: "$3.99",
      periodLabel: "per week",
      subtitle: "billed weekly",
      planKey: "weekly",
      offeringKey: "weekly",
      revenueCatOfferingId: "journalio_offering_other_screens_standard",
      revenueCatPackageId: "$rc_weekly",
      rcPackage: { identifier: "$rc_weekly", product: { identifier: "app.journalio.premium.weekly" } },
      introOffer: null,
    },
  ]),
  hasPremiumAccess: jest.fn(() => false),
  purchaseRevenueCatPackage: jest.fn(async () => ({ customerInfo: {} })),
  refreshRevenueCatEntitlementState: jest.fn(async () => ({ customerInfo: null })),
  restoreRevenueCatPurchases: jest.fn(async () => ({})),
}));

jest.mock("../src/services/paywallService", () => ({
  getPaywallConfig: jest.fn(async () => ({
    shouldShow: true,
    placementKey: "insights_ai_tab_locked",
    screenKey: "insights",
    triggerMode: "contextual",
    wasInterruptive: false,
    reason: "ready",
    template: {
      key: "weekly-standard",
      title: "Premium",
      headline: "Unlock premium",
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
    offerings: [],
  })),
  isRetryableEntitlementSyncError: jest.fn(() => false),
  syncPaywallPurchase: jest.fn(async () => ({})),
  trackPaywallEvent: jest.fn(async () => ({})),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

const flushPromises = async () => {
  await Promise.resolve();
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

describe("PaywallScreen (custom P1)", () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    ReactTestRenderer.act(() => {
      resetAppStore();
      useAppStore.setState({
        activePaywallPlacementKey: "insights_ai_tab_locked",
        activePaywallScreenKey: "insights",
        activePaywallTriggerMode: "contextual",
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

  it("renders feature-specific copy, both plans, and the trial CTA", async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider modeOverride="dark">
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>
            <PaywallScreen onBack={jest.fn()} />
          </SafeAreaProvider>
        </ThemeProvider>
      );
      await flushPromises();
    });

    const text = extractText(renderer!.toJSON());
    // Contextual copy for the AI-insights placement.
    expect(text).toContain("Your weekly read is ready.");
    // Both live plans + trial CTA + trust affordances.
    expect(text).toContain("$39.99");
    expect(text).toContain("$3.99");
    expect(text).toContain("Start 7-day free trial");
    // Footer legal + restore row.
    expect(text).toContain("Restore");
    expect(text).toContain("Terms");
    expect(text).toContain("Privacy");
    // The value list is introduced by a "What's included" label.
    expect(text).toContain("What's included");
  });

  it("dismisses to the free version when the close button is tapped", async () => {
    const onBack = jest.fn();
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider modeOverride="dark">
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>
            <PaywallScreen onBack={onBack} />
          </SafeAreaProvider>
        </ThemeProvider>
      );
      await flushPromises();
    });

    await ReactTestRenderer.act(async () => {
      renderer!.root.findByProps({ accessibilityLabel: "Close" }).props.onPress();
      await Promise.resolve();
    });

    expect(onBack).toHaveBeenCalledWith("dismiss");
  });

  it("lists every premium feature regardless of which gate opened it", async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider modeOverride="dark">
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>
            <PaywallScreen onBack={jest.fn()} />
          </SafeAreaProvider>
        </ThemeProvider>
      );
      await flushPromises();
    });

    const text = extractText(renderer!.toJSON());
    PREMIUM_FEATURES.forEach(feature => {
      expect(text).toContain(feature.text);
    });
  });

  it("renders the ambient orb on a root paywall but not a contextual one", async () => {
    const renderPaywall = async () => {
      await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider modeOverride="dark">
            <SafeAreaProvider initialMetrics={safeAreaMetrics}>
              <PaywallScreen onBack={jest.fn()} />
            </SafeAreaProvider>
          </ThemeProvider>
        );
        await flushPromises();
      });
    };

    // Post-onboarding and the relaunch route replace the navigation root.
    await renderPaywall();
    expect(
      renderer!.root.findAllByProps({ testID: "paywall-ambient-orb" }).length
    ).toBeGreaterThan(0);

    ReactTestRenderer.act(() => {
      renderer?.unmount();
      renderer = null;
    });

    // A gate stacks the paywall over its caller and keeps the plain background.
    ReactTestRenderer.act(() => {
      useAppStore.setState({ isPaywallOverlay: true });
    });
    await renderPaywall();
    expect(
      renderer!.root.findAllByProps({ testID: "paywall-ambient-orb" })
    ).toHaveLength(0);
  });

  it("hands the orb to Home when a root paywall is dismissed", async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider modeOverride="dark">
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>
            <PaywallScreen onBack={jest.fn()} />
          </SafeAreaProvider>
        </ThemeProvider>
      );
      await flushPromises();
    });

    await ReactTestRenderer.act(async () => {
      renderer!.root.findByProps({ accessibilityLabel: "Close" }).props.onPress();
      await Promise.resolve();
    });

    const handoff = useAppStore.getState().orbHandoff;
    expect(handoff).not.toBeNull();
    expect(handoff?.from.size).toBeGreaterThan(safeAreaMetrics.frame.width);
    expect(handoff?.to).toBeNull();
    // The paywall's own orb goes before the overlay's copy appears.
    expect(
      renderer!.root.findAllByProps({ testID: "paywall-ambient-orb" })
    ).toHaveLength(0);
  });

  it("does not hand off the orb from a contextual paywall", async () => {
    ReactTestRenderer.act(() => {
      useAppStore.setState({ isPaywallOverlay: true });
    });

    const onBack = jest.fn();
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider modeOverride="dark">
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>
            <PaywallScreen onBack={onBack} />
          </SafeAreaProvider>
        </ThemeProvider>
      );
      await flushPromises();
    });

    await ReactTestRenderer.act(async () => {
      renderer!.root.findByProps({ accessibilityLabel: "Close" }).props.onPress();
      await Promise.resolve();
    });

    expect(onBack).toHaveBeenCalledWith("dismiss");
    expect(useAppStore.getState().orbHandoff).toBeNull();
  });

  it("sizes both plan cards to the taller one", async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider modeOverride="dark">
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>
            <PaywallScreen onBack={jest.fn()} />
          </SafeAreaProvider>
        </ThemeProvider>
      );
      await flushPromises();
    });

    // Only the yearly card carries an intro tag, so the two cards have
    // different content heights. They have to resolve to the same laid-out
    // height anyway: grow from an auto basis inside a stretched row.
    const cards = renderer!.root
      .findAll(node => typeof node.type === "string")
      .map(node => StyleSheet.flatten(node.props.style))
      .filter(style => style && style.minHeight === 118);

    expect(cards).toHaveLength(2);
    cards.forEach(style => {
      expect(style.flexGrow).toBe(1);
      // A fixed height is what made the card clip a long price in the first
      // place, and `flexBasis: 0` would collapse the row back to `minHeight`.
      expect(style.height).toBeUndefined();
      expect(style.flexBasis).toBeUndefined();
    });
  });

  it("keeps a long localized price on one shrinking line", async () => {
    // StoreKit hands back whatever the user's storefront charges, and the plan
    // card is ~133pt wide on a compact phone. Indonesia is the worst realistic
    // case; left to wrap it used to push past the card.
    const revenueCatService = jest.requireMock("../src/services/revenueCatService");
    const originalPlans = revenueCatService.getRevenueCatPaywallPlans
      .getMockImplementation();

    revenueCatService.getRevenueCatPaywallPlans.mockImplementation(() => [
      {
        id: "yearly",
        title: "Yearly",
        durationLabel: "Yearly",
        price: "Rp 1.499.000",
        periodLabel: "per year",
        subtitle: "Rp 124.917/mo",
        planKey: "annual",
        offeringKey: "yearly",
        revenueCatOfferingId: "journalio_offering_other_screens_standard",
        revenueCatPackageId: "$rc_annual",
        rcPackage: {
          identifier: "$rc_annual",
          product: { identifier: "app.journalio.premium.yearly" },
        },
        introOffer: null,
      },
    ]);

    try {
      await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider modeOverride="dark">
            <SafeAreaProvider initialMetrics={safeAreaMetrics}>
              <PaywallScreen onBack={jest.fn()} />
            </SafeAreaProvider>
          </ThemeProvider>
        );
        await flushPromises();
      });

      // The seam forwards props down to the host `Text`, so several instances
      // carry the testID. The deepest one is what actually renders.
      const matches = renderer!.root.findAllByProps({
        testID: "paywall-plan-price-yearly",
      });
      const price = matches[matches.length - 1];

      expect(price.props.children).toBe("Rp 1.499.000");
      expect(price.props.numberOfLines).toBe(1);
      expect(price.props.adjustsFontSizeToFit).toBe(true);
      expect(price.props.minimumFontScale).toBeLessThanOrEqual(0.7);

      // The period reads as its own line, and the price never carries it.
      const text = extractText(renderer!.toJSON());
      expect(text).toContain("per year");
      expect(text).not.toContain("Rp 1.499.000/year");
    } finally {
      revenueCatService.getRevenueCatPaywallPlans.mockImplementation(
        originalPlans
      );
    }
  });
});
