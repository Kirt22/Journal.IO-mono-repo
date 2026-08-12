/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import YearlyOfferPaywallScreen from "../src/screens/profile/YearlyOfferPaywallScreen";
import { resetAppStore, useAppStore } from "../src/store/appStore";
import { getRevenueCatOfferings } from "../src/services/revenueCatService";
import { getPaywallConfig } from "../src/services/paywallService";

const buildPackage = (
  offeringId: string,
  productId: string,
  priceString: string,
  currencyCode = "USD"
) => ({
  identifier: "$rc_annual",
  packageType: "ANNUAL",
  presentedOfferingContext: { offeringIdentifier: offeringId },
  product: {
    identifier: productId,
    priceString,
    currencyCode,
    price: Number(priceString.replace(/[^0-9.]/g, "")),
    title: "Yearly Premium",
  },
});

const buildOfferings = ({
  standardCurrency = "USD",
  includeStandard = true,
  includeDiscount = true,
}: {
  standardCurrency?: string;
  includeStandard?: boolean;
  includeDiscount?: boolean;
} = {}) => {
  const all: Record<string, any> = {};

  if (includeDiscount) {
    all.journalio_offering_post_onboarding_exit = {
      identifier: "journalio_offering_post_onboarding_exit",
      availablePackages: [
        buildPackage(
          "journalio_offering_post_onboarding_exit",
          "app.journalio.premium.yearly.exit",
          "$29.99"
        ),
      ],
    };
  }

  if (includeStandard) {
    all.journalio_offering_other_screens_standard = {
      identifier: "journalio_offering_other_screens_standard",
      availablePackages: [
        buildPackage(
          "journalio_offering_other_screens_standard",
          "app.journalio.premium.yearly",
          standardCurrency === "USD" ? "$59.99" : "₹4,999",
          standardCurrency
        ),
      ],
    };
  }

  return { current: null, all };
};

jest.mock("../src/services/revenueCatService", () => ({
  getPackageByProductId: jest.fn(
    (offerings: any, offeringId: string, productId: string) =>
      offerings?.all?.[offeringId]?.availablePackages?.find(
        (rcPackage: any) => rcPackage.product.identifier === productId
      ) ?? null
  ),
  getRevenueCatActiveEntitlement: jest.fn(() => null),
  getRevenueCatConfigurationError: jest.fn(() => null),
  getRevenueCatOfferings: jest.fn(),
  getRevenueCatPurchaseAttribution: jest.fn(() => null),
  hasPremiumAccess: jest.fn(() => false),
  purchaseRevenueCatPackage: jest.fn(),
  refreshRevenueCatEntitlementState: jest.fn(async () => ({
    customerInfo: null,
    activeEntitlement: null,
    hasPremiumAccess: false,
  })),
  resolveProductPriceString: jest.fn(
    (product: any) => product?.priceString ?? ""
  ),
  restoreRevenueCatPurchases: jest.fn(),
}));

jest.mock("../src/services/paywallService", () => ({
  getPaywallConfig: jest.fn(async () => ({
    shouldShow: true,
    placementKey: "post_auth_exit_offer",
    screenKey: "home",
    triggerMode: "contextual",
    wasInterruptive: false,
    reason: "eligible",
    template: {
      key: "post-auth-exit-offer",
      featureList: [],
      visibleOfferingKeys: ["yearly_exit_offer"],
    },
    offerings: [],
  })),
  isRetryableEntitlementSyncError: jest.fn(() => false),
  syncPaywallPurchase: jest.fn(),
  trackPaywallEvent: jest.fn(async () => ({
    eventId: "event-test",
    createdAt: "2026-04-23T00:00:00.000Z",
  })),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

const extractText = (node: any): string => {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join(" ");
  }
  return extractText(node.children);
};

const renderScreen = async (props: {
  onBack?: jest.Mock;
  onUnavailable?: jest.Mock;
} = {}) => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <YearlyOfferPaywallScreen
          onBack={props.onBack ?? jest.fn()}
          onUnavailable={props.onUnavailable}
        />
      </SafeAreaProvider>
    );

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return root;
};

beforeEach(() => {
  jest.clearAllMocks();
  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.setState({
      session: {
        token: "token",
        user: {
          userId: "user-1",
          email: "kirtan@example.com",
          name: "Kirtan",
          isPremium: false,
        },
      },
    } as any);
  });
  (getRevenueCatOfferings as jest.Mock).mockResolvedValue(buildOfferings());
});

test("shows the discounted price beside the struck-through standard price", async () => {
  const root = await renderScreen();

  expect(
    root.root.findByProps({ testID: "yearly-offer-discount-price" }).props.value
  ).toBe("$29.99");
  expect(
    root.root.findByProps({ testID: "yearly-offer-standard-price" }).props.value
  ).toBe("$59.99");

  const tree = extractText(root.toJSON());
  expect(tree).toContain("50% OFF");
  expect(tree).toContain("/year");
  expect(tree).toContain("Claim this offer");
  // The offer badge is the shaking hero icon.
  expect(root.root.findAllByProps({ testID: "yearly-offer-icon" }).length).toBeGreaterThan(0);
});

test("hides the struck-through price when the two prices are in different currencies", async () => {
  (getRevenueCatOfferings as jest.Mock).mockResolvedValue(
    buildOfferings({ standardCurrency: "INR" })
  );

  const root = await renderScreen();

  expect(
    root.root.findByProps({ testID: "yearly-offer-discount-price" }).props.value
  ).toBe("$29.99");
  expect(
    root.root.findAllByProps({ testID: "yearly-offer-standard-price" })
  ).toHaveLength(0);
});

test("hides the struck-through price when the standard yearly package is missing", async () => {
  (getRevenueCatOfferings as jest.Mock).mockResolvedValue(
    buildOfferings({ includeStandard: false })
  );

  const root = await renderScreen();

  expect(
    root.root.findByProps({ testID: "yearly-offer-discount-price" }).props.value
  ).toBe("$29.99");
  expect(
    root.root.findAllByProps({ testID: "yearly-offer-standard-price" })
  ).toHaveLength(0);
});

test("falls back when the discounted package cannot be resolved", async () => {
  (getRevenueCatOfferings as jest.Mock).mockResolvedValue(
    buildOfferings({ includeDiscount: false })
  );
  const onUnavailable = jest.fn();

  await renderScreen({ onUnavailable });

  expect(onUnavailable).toHaveBeenCalledTimes(1);
});

test("honours the server-side throttle and continues without showing the offer", async () => {
  (getPaywallConfig as jest.Mock).mockResolvedValueOnce({
    shouldShow: false,
    placementKey: "post_auth_exit_offer",
    screenKey: "home",
    triggerMode: "contextual",
    wasInterruptive: false,
    reason: "throttled",
    template: null,
    offerings: [],
  });
  const onBack = jest.fn();

  await renderScreen({ onBack });

  expect(onBack).toHaveBeenCalledWith("continue");
  expect(getRevenueCatOfferings).not.toHaveBeenCalled();
});
