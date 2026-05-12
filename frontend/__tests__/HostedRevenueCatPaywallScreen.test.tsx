/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HostedRevenueCatPaywallScreen from "../src/screens/profile/HostedRevenueCatPaywallScreen";
import { resetAppStore, useAppStore } from "../src/store/appStore";
import { hasRevenueCatHostedPaywall } from "../src/services/revenueCatService";
import {
  getPaywallConfig,
  syncPaywallPurchase,
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

  it("shows sanitized copy for hosted Test Store purchase failures", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation(() => undefined);

    try {
      await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>
            <HostedRevenueCatPaywallScreen />
          </SafeAreaProvider>
        );

        await flushPromises();
      });

      const { default: RevenueCatUI } = require("react-native-purchases-ui");

      await ReactTestRenderer.act(async () => {
        RevenueCatUI.Paywall.mock.calls[0][0].onPurchaseError({
          error: {
            code: "42",
            message:
              "Error 42: Purchase failure simulated successfully in Test Store.",
            readableErrorCode: "TEST_STORE_SIMULATED_PURCHASE_ERROR",
            userInfo: {
              readableErrorCode: "TEST_STORE_SIMULATED_PURCHASE_ERROR",
            },
            underlyingErrorMessage:
              "Purchase failure simulated successfully in Test Store.",
            userCancelled: false,
          },
        });
        await flushPromises();
      });

      const sanitizedMessage =
        "The test purchase was declined. No charge was made. You can try again when you're ready.";

      expect(alertSpy).toHaveBeenCalledWith(
        "Purchase not completed",
        sanitizedMessage
      );
      expect(trackPaywallEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "purchase_failure",
          metadata: expect.objectContaining({
            message: sanitizedMessage,
          }),
        })
      );
    } finally {
      alertSpy.mockRestore();
    }
  });

  it("does not continue when hosted restore finds no active purchase", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation(() => undefined);

    try {
      await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>
            <HostedRevenueCatPaywallScreen />
          </SafeAreaProvider>
        );

        await flushPromises();
      });

      const { default: RevenueCatUI } = require("react-native-purchases-ui");

      await ReactTestRenderer.act(async () => {
        RevenueCatUI.Paywall.mock.calls[0][0].onRestoreCompleted({
          customerInfo: {
            entitlements: {
              active: {},
            },
          },
        });
        await flushPromises();
      });

      const noPurchasesMessage =
        "We could not find an active premium purchase for this account.";

      expect(alertSpy).toHaveBeenCalledWith(
        "No purchases found",
        noPurchasesMessage
      );
      expect(syncPaywallPurchase).not.toHaveBeenCalled();
      expect(useAppStore.getState().stage).toBe("hosted-paywall");
      expect(trackPaywallEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "purchase_failure",
          metadata: expect.objectContaining({
            action: "restore",
            message: noPurchasesMessage,
          }),
        })
      );
    } finally {
      alertSpy.mockRestore();
    }
  });

  it("keeps the hosted success flow alive when RevenueCat dismisses during first-time purchase finalization", async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={safeAreaMetrics}>
          <HostedRevenueCatPaywallScreen />
        </SafeAreaProvider>
      );

      await flushPromises();
    });

    const { default: RevenueCatUI } = require("react-native-purchases-ui");
    const paywallCallIndex = RevenueCatUI.Paywall.mock.calls.length - 1;
    const paywallProps = RevenueCatUI.Paywall.mock.calls[paywallCallIndex][0];

    await ReactTestRenderer.act(async () => {
      paywallProps.onPurchaseStarted({
        packageBeingPurchased: {
          identifier: "$rc_annual",
        },
      });
      paywallProps.onDismiss();
      await flushPromises();
    });

    expect(useAppStore.getState().stage).toBe("hosted-paywall");
    expect(trackPaywallEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "paywall_dismiss",
      })
    );
    expect(extractText(renderer?.toJSON())).toContain(
      "Processing your purchase..."
    );

    await ReactTestRenderer.act(async () => {
      paywallProps.onPurchaseCompleted({
        customerInfo: {
          entitlements: {
            active: {},
          },
        },
        storeTransaction: {},
      });
      await flushPromises();
    });

    expect(extractText(renderer?.toJSON())).toContain("Purchase received");
    expect(useAppStore.getState().stage).toBe("hosted-paywall");
  });

  it("shows the payment success surface when hosted purchase is completed before entitlement sync catches up", async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={safeAreaMetrics}>
          <HostedRevenueCatPaywallScreen />
        </SafeAreaProvider>
      );

      await flushPromises();
    });

    const { default: RevenueCatUI } = require("react-native-purchases-ui");

    await ReactTestRenderer.act(async () => {
      RevenueCatUI.Paywall.mock.calls[0][0].onPurchaseCompleted({
        customerInfo: {
          entitlements: {
            active: {},
          },
        },
        storeTransaction: {},
      });
      await flushPromises();
    });

    expect(syncPaywallPurchase).not.toHaveBeenCalled();
    expect(extractText(renderer?.toJSON())).toContain("Purchase received");
    expect(extractText(renderer?.toJSON())).toContain(
      "Your purchase went through. We are still updating premium access on this account."
    );
    expect(useAppStore.getState().stage).toBe("hosted-paywall");
    expect(trackPaywallEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "purchase_success",
        metadata: expect.objectContaining({
          activationPending: true,
        }),
      })
    );
  });
});
