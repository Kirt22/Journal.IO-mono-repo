const createPackage = ({
  identifier,
  productIdentifier,
  packageType,
  priceString,
  currencyCode,
  offeringIdentifier,
}: {
  identifier: string;
  productIdentifier: string;
  packageType: string;
  priceString: string;
  currencyCode: string;
  offeringIdentifier: string;
}) =>
  ({
    identifier,
    packageType,
    presentedOfferingContext: {
      offeringIdentifier,
      placementIdentifier: null,
      targetingContext: null,
    },
    product: {
      identifier: productIdentifier,
      title: productIdentifier,
      description: "",
      price: 0,
      priceString,
      currencyCode,
      pricePerMonthString: null,
      introPrice: null,
      presentedOfferingIdentifier: offeringIdentifier,
    },
  }) as any;

const createOffering = (identifier: string, packages: any[]) =>
  ({
    identifier,
    serverDescription: identifier,
    metadata: {},
    availablePackages: packages,
    annual:
      packages.find(rcPackage => rcPackage.packageType === "ANNUAL") ?? null,
    weekly:
      packages.find(rcPackage => rcPackage.packageType === "WEEKLY") ?? null,
    monthly: null,
    twoMonth: null,
    threeMonth: null,
    sixMonth: null,
    lifetime:
      packages.find(rcPackage => rcPackage.packageType === "LIFETIME") ?? null,
    webCheckoutUrl: null,
  }) as any;

const createConfiguredOffering = (
  key: "weekly" | "yearly" | "yearly_exit_offer" | "lifetime",
  sortOrder: number
) =>
  ({
    key,
    title: key.toUpperCase(),
    price: null,
    priceSuffix: null,
    subtitle: null,
    badge: null,
    highlight: null,
    sortOrder,
    revenueCatOfferingId: null,
    revenueCatPackageId: null,
    purchasedUsersCount: 0,
    purchaseLimit: null,
  }) as any;

describe("revenueCatService", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("routes each hosted surface to its explicit offering", () => {
    const { getRevenueCatHostedOfferingId } = require(
      "../src/services/revenueCatService"
    );

    expect(getRevenueCatHostedOfferingId("main", "post_auth")).toBe(
      "journalio_offering_other_screens_standard"
    );
    expect(getRevenueCatHostedOfferingId("main", "subscription_screen")).toBe(
      "journalio_offering_other_screens_standard"
    );
    expect(getRevenueCatHostedOfferingId("exit", "post_auth_exit_offer")).toBe(
      "journalio_offering_post_onboarding_exit"
    );
  });

  it("finds packages by exact offering and product identifiers", () => {
    const { getPackageByProductId } = require(
      "../src/services/revenueCatService"
    );
    const normalYearly = createPackage({
      identifier: "$rc_annual",
      productIdentifier: "app.journalio.premium.yearly",
      packageType: "ANNUAL",
      priceString: "₹2,999",
      currencyCode: "INR",
      offeringIdentifier: "journalio_offering_other_screens_standard",
    });
    const discountYearly = createPackage({
      identifier: "discount_annual",
      productIdentifier: "app.journalio.premium.yearly.exit",
      packageType: "ANNUAL",
      priceString: "₹1,499",
      currencyCode: "INR",
      offeringIdentifier: "journalio_offering_post_onboarding_exit",
    });
    const offerings = {
      current: createOffering(
        "journalio_offering_post_onboarding_exit",
        [discountYearly]
      ),
      all: {
        journalio_offering_other_screens_standard: createOffering(
          "journalio_offering_other_screens_standard",
          [normalYearly]
        ),
        journalio_offering_post_onboarding_exit: createOffering(
          "journalio_offering_post_onboarding_exit",
          [discountYearly]
        ),
      },
    } as any;

    expect(
      getPackageByProductId(
        offerings,
        "journalio_offering_other_screens_standard",
        "app.journalio.premium.yearly"
      )
    ).toBe(normalYearly);
    expect(
      getPackageByProductId(
        offerings,
        "journalio_offering_other_screens_standard",
        "app.journalio.premium.yearly.exit"
      )
    ).toBeNull();
  });

  it("keeps a partial standard offering purchasable and preserves INR pricing", () => {
    const { getRevenueCatPaywallPlans } = require(
      "../src/services/revenueCatService"
    );
    const weekly = createPackage({
      identifier: "$rc_weekly",
      productIdentifier: "app.journalio.premium.weekly",
      packageType: "WEEKLY",
      priceString: "₹199",
      currencyCode: "INR",
      offeringIdentifier: "journalio_offering_other_screens_standard",
    });
    const offerings = {
      current: null,
      all: {
        journalio_offering_other_screens_standard: createOffering(
          "journalio_offering_other_screens_standard",
          [weekly]
        ),
      },
    } as any;

    const plans = getRevenueCatPaywallPlans(
      offerings,
      [
        createConfiguredOffering("yearly", 1),
        createConfiguredOffering("weekly", 2),
      ],
      { placementKey: "post_auth" }
    );

    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      id: "weekly",
      durationLabel: "₹199",
      price: "₹199/week",
      rcPackage: weekly,
    });
  });

  it("does not use offerings.current for other-screen configured plans", () => {
    const { getRevenueCatPaywallPlans } = require(
      "../src/services/revenueCatService"
    );
    const normalYearly = createPackage({
      identifier: "$rc_annual",
      productIdentifier: "app.journalio.premium.yearly",
      packageType: "ANNUAL",
      priceString: "$59.99",
      currencyCode: "USD",
      offeringIdentifier: "journalio_offering_other_screens_standard",
    });
    const discountYearly = createPackage({
      identifier: "discount_annual",
      productIdentifier: "app.journalio.premium.yearly.exit",
      packageType: "ANNUAL",
      priceString: "$29.99",
      currencyCode: "USD",
      offeringIdentifier: "journalio_offering_post_onboarding_exit",
    });
    const discountOffering = createOffering(
      "journalio_offering_post_onboarding_exit",
      [discountYearly]
    );
    const offerings = {
      current: discountOffering,
      all: {
        journalio_offering_other_screens_standard: createOffering(
          "journalio_offering_other_screens_standard",
          [normalYearly]
        ),
        journalio_offering_post_onboarding_exit: discountOffering,
      },
    } as any;

    const plans = getRevenueCatPaywallPlans(
      offerings,
      [createConfiguredOffering("yearly", 1)],
      { placementKey: "subscription_screen" }
    );

    expect(plans).toHaveLength(1);
    expect(plans[0].rcPackage).toBe(normalYearly);
    expect(plans[0].durationLabel).toBe("$59.99");
  });

  it("resolves summer and lifetime packages from their dedicated offerings", () => {
    const {
      getPackageByProductId,
      getRevenueCatOfferingKeyForProductIdentifier,
    } = require("../src/services/revenueCatService");
    const summer = createPackage({
      identifier: "summer",
      productIdentifier: "app.journalio.premium.yearly.exit",
      packageType: "ANNUAL",
      priceString: "₹1,499",
      currencyCode: "INR",
      offeringIdentifier: "journalio_offering_post_onboarding_exit",
    });
    const lifetime = createPackage({
      identifier: "$rc_lifetime",
      productIdentifier: "app.journalio.premium.lifetime",
      packageType: "LIFETIME",
      priceString: "₹9,999",
      currencyCode: "INR",
      offeringIdentifier: "journalio_offering_lifetime",
    });
    const offerings = {
      current: null,
      all: {
        journalio_offering_post_onboarding_exit: createOffering(
          "journalio_offering_post_onboarding_exit",
          [summer]
        ),
        journalio_offering_lifetime: createOffering(
          "journalio_offering_lifetime",
          [lifetime]
        ),
      },
    } as any;

    expect(
      getPackageByProductId(
        offerings,
        "journalio_offering_post_onboarding_exit",
        "app.journalio.premium.yearly.exit"
      )
    ).toBe(summer);
    expect(
      getPackageByProductId(
        offerings,
        "journalio_offering_lifetime",
        "app.journalio.premium.lifetime"
      )
    ).toBe(lifetime);
    expect(
      getRevenueCatOfferingKeyForProductIdentifier(
        "app.journalio.premium.yearly.exit"
      )
    ).toBe("yearly_exit_offer");
  });

  it("requires the exact Journal.IO Pro entitlement", () => {
    const {
      getRevenueCatActiveEntitlement,
      hasRevenueCatPremiumAccess,
    } = require("../src/services/revenueCatService");
    const unrelatedCustomerInfo = {
      entitlements: {
        active: {
          premium_access: {
            identifier: "premium_access",
            isActive: true,
          },
        },
      },
    } as any;

    expect(getRevenueCatActiveEntitlement(unrelatedCustomerInfo)).toBeNull();
    expect(hasRevenueCatPremiumAccess(unrelatedCustomerInfo)).toBe(false);
  });

  it("attributes purchase and restore sync from the active product, not UI selection", () => {
    const { getRevenueCatPurchaseAttribution } = require(
      "../src/services/revenueCatService"
    );
    const lifetime = createPackage({
      identifier: "$rc_lifetime",
      productIdentifier: "app.journalio.premium.lifetime",
      packageType: "LIFETIME",
      priceString: "$149.99",
      currencyCode: "USD",
      offeringIdentifier: "journalio_offering_lifetime",
    });
    const offerings = {
      current: null,
      all: {
        journalio_offering_lifetime: createOffering(
          "journalio_offering_lifetime",
          [lifetime]
        ),
      },
    } as any;
    const customerInfo = {
      entitlements: {
        active: {
          "Journal.IO Pro": {
            identifier: "Journal.IO Pro",
            isActive: true,
            store: "APP_STORE",
            productIdentifier: "app.journalio.premium.lifetime",
          },
        },
      },
    } as any;

    expect(
      getRevenueCatPurchaseAttribution(customerInfo, offerings)
    ).toMatchObject({
      offeringKey: "lifetime",
      productIdentifier: "app.journalio.premium.lifetime",
      revenueCatOfferingId: "journalio_offering_lifetime",
      revenueCatPackageId: "$rc_lifetime",
      rcPackage: lifetime,
    });
  });
});
