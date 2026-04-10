describe("revenueCatService", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("maps the current offering into sorted paywall plans", async () => {
    const { getRevenueCatPaywallPlans } = require("../src/services/revenueCatService");

    const plans = getRevenueCatPaywallPlans({
      current: {
        identifier: "default",
        serverDescription: "Default offering",
        metadata: {},
        availablePackages: [
          {
            identifier: "weekly_plan",
            packageType: "WEEKLY",
            product: {
              priceString: "$7.99",
              pricePerMonthString: null,
              title: "Weekly Premium",
            },
          },
          {
            identifier: "annual_plan",
            packageType: "ANNUAL",
            product: {
              priceString: "$59.99",
              pricePerMonthString: "$5.00",
              title: "Yearly Premium",
            },
          },
        ],
        annual: {
          identifier: "annual_plan",
          packageType: "ANNUAL",
          product: {
            priceString: "$59.99",
            pricePerMonthString: "$5.00",
            title: "Yearly Premium",
          },
        },
        weekly: {
          identifier: "weekly_plan",
          packageType: "WEEKLY",
          product: {
            priceString: "$7.99",
            pricePerMonthString: null,
            title: "Weekly Premium",
          },
        },
        monthly: null,
        twoMonth: null,
        threeMonth: null,
        sixMonth: null,
        lifetime: null,
        webCheckoutUrl: null,
      },
      all: {},
    } as any);

    expect(plans).toHaveLength(2);
    expect(plans.map(plan => plan.title)).toEqual(["YEARLY", "WEEKLY"]);
    expect(plans[0]?.badge).toBe("Most Value");
    expect(plans[0]?.subtitle).toBe("$5.00/month equivalent");
    expect(plans[1]?.price).toBe("$7.99/week");
  });

  it("uses the configured entitlement id to resolve premium access", async () => {
    const {
      getRevenueCatActiveEntitlement,
      hasRevenueCatPremiumAccess,
    } = require("../src/services/revenueCatService");

    const customerInfo = {
      entitlements: {
        active: {
          "Journal.IO Pro": {
            identifier: "Journal.IO Pro",
            isActive: true,
            store: "TEST_STORE",
          },
        },
      },
    };

    expect(hasRevenueCatPremiumAccess(customerInfo as any)).toBe(true);
    expect(getRevenueCatActiveEntitlement(customerInfo as any)?.store).toBe(
      "TEST_STORE"
    );
  });

  it("falls back to the first active entitlement when the configured id is not present", async () => {
    const {
      getRevenueCatActiveEntitlement,
      hasRevenueCatPremiumAccess,
    } = require("../src/services/revenueCatService");

    const customerInfo = {
      entitlements: {
        active: {
          premium_access: {
            identifier: "premium_access",
            isActive: true,
            store: "TEST_STORE",
          },
        },
      },
    };

    expect(hasRevenueCatPremiumAccess(customerInfo as any)).toBe(true);
    expect(getRevenueCatActiveEntitlement(customerInfo as any)?.identifier).toBe(
      "premium_access"
    );
  });

  it("returns a setup error when no RevenueCat public key is configured", async () => {
    const { getRevenueCatConfigurationError } = require(
      "../src/services/revenueCatService"
    );

    expect(getRevenueCatConfigurationError()).toEqual(expect.any(String));
  });

  it("maps Mongo-driven offerings to matching RevenueCat packages", async () => {
    const { getRevenueCatPaywallPlans } = require("../src/services/revenueCatService");

    const plans = getRevenueCatPaywallPlans(
      {
        current: null,
        all: {
          journalio_offering_dev: {
            identifier: "journalio_offering_dev",
            serverDescription: "Journal.IO Offering Dev",
            metadata: {},
            availablePackages: [
              {
                identifier: "$rc_annual",
                packageType: "ANNUAL",
                product: {
                  priceString: "$99.99",
                  pricePerMonthString: "$8.33",
                  title: "Yearly Premium",
                },
              },
            ],
            annual: {
              identifier: "$rc_annual",
              packageType: "ANNUAL",
              product: {
                priceString: "$99.99",
                pricePerMonthString: "$8.33",
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
        },
      } as any,
      [
        {
          key: "yearly",
          title: "YEARLY",
          price: "$99.99",
          priceSuffix: "/year",
          subtitle: "Best value",
          badge: "Most Value",
          highlight: "$8.33/month",
          sortOrder: 1,
          revenueCatOfferingId: "journalio_offering_dev",
          revenueCatPackageId: "$rc_annual",
          purchasedUsersCount: 0,
          purchaseLimit: null,
        },
      ]
    );

    expect(plans).toHaveLength(1);
    expect(plans[0]?.title).toBe("YEARLY");
    expect(plans[0]?.rcPackage.identifier).toBe("$rc_annual");
  });

  it("maps weekly and yearly configured offerings by their RevenueCat offering ids", async () => {
    const { getRevenueCatPaywallPlans } = require("../src/services/revenueCatService");

    const plans = getRevenueCatPaywallPlans(
      {
        current: null,
        all: {
          journalio_offering_dev: {
            identifier: "journalio_offering_dev",
            serverDescription: "Journal.IO Offering Dev",
            metadata: {},
            availablePackages: [
              {
                identifier: "$rc_weekly",
                packageType: "WEEKLY",
                product: {
                  priceString: "$4.99",
                  pricePerMonthString: null,
                  title: "Weekly Premium",
                },
              },
              {
                identifier: "$rc_annual",
                packageType: "ANNUAL",
                product: {
                  priceString: "$99.99",
                  pricePerMonthString: "$8.33",
                  title: "Yearly Premium",
                },
              },
            ],
            annual: {
              identifier: "$rc_annual",
              packageType: "ANNUAL",
              product: {
                priceString: "$99.99",
                pricePerMonthString: "$8.33",
                title: "Yearly Premium",
              },
            },
            weekly: {
              identifier: "$rc_weekly",
              packageType: "WEEKLY",
              product: {
                priceString: "$4.99",
                pricePerMonthString: null,
                title: "Weekly Premium",
              },
            },
            monthly: null,
            twoMonth: null,
            threeMonth: null,
            sixMonth: null,
            lifetime: null,
            webCheckoutUrl: null,
          },
        },
      } as any,
      [
        {
          key: "weekly",
          title: "WEEKLY",
          price: "$4.99",
          priceSuffix: "/week",
          subtitle: "Flexible access",
          badge: null,
          highlight: null,
          sortOrder: 1,
          revenueCatOfferingId: "journalio_offering_dev",
          revenueCatPackageId: "$rc_weekly",
          purchasedUsersCount: 0,
          purchaseLimit: null,
        },
        {
          key: "yearly",
          title: "YEARLY",
          price: "$99.99",
          priceSuffix: "/year",
          subtitle: "Best value",
          badge: "Most Value",
          highlight: "$8.33/month",
          sortOrder: 2,
          revenueCatOfferingId: "journalio_offering_dev",
          revenueCatPackageId: "$rc_annual",
          purchasedUsersCount: 0,
          purchaseLimit: null,
        },
      ]
    );

    expect(plans).toHaveLength(2);
    expect(plans.map((plan: any) => plan.id)).toEqual(["weekly", "yearly"]);
    expect(plans[0]?.rcPackage?.identifier).toBe("$rc_weekly");
    expect(plans[1]?.rcPackage?.identifier).toBe("$rc_annual");
  });

  it("keeps Mongo-driven pricing cards visible when RevenueCat package matching is missing", async () => {
    const { getRevenueCatPaywallPlans } = require("../src/services/revenueCatService");

    const plans = getRevenueCatPaywallPlans(
      {
        current: null,
        all: {},
      } as any,
      [
        {
          key: "lifetime",
          title: "LIFETIME",
          price: "$200",
          priceSuffix: " one-time",
          subtitle: "One-time unlock",
          badge: "Founding Offer",
          highlight: "First 500 users",
          sortOrder: 1,
          revenueCatOfferingId: "journalio_offering_dev",
          revenueCatPackageId: "$rc_lifetime",
          purchasedUsersCount: 0,
          purchaseLimit: 500,
        },
      ]
    );

    expect(plans).toHaveLength(1);
    expect(plans[0]?.title).toBe("LIFETIME");
    expect(plans[0]?.price).toBe("$200 one-time");
    expect(plans[0]?.rcPackage).toBeNull();
    expect(plans[0]?.highlight).toBe("Be one of the first founding members");
  });

  it("shows claimed lifetime slots when purchasers already exist", async () => {
    const { getRevenueCatPaywallPlans } = require("../src/services/revenueCatService");

    const plans = getRevenueCatPaywallPlans(
      {
        current: null,
        all: {},
      } as any,
      [
        {
          key: "lifetime",
          title: "LIFETIME",
          price: "$200",
          priceSuffix: "one-time",
          subtitle: "One-time unlock",
          badge: "Founding Offer",
          highlight: "First 500 users",
          sortOrder: 1,
          revenueCatOfferingId: "journalio_offering_dev",
          revenueCatPackageId: "$rc_lifetime",
          purchasedUsersCount: 42,
          purchaseLimit: 500,
        },
      ]
    );

    expect(plans).toHaveLength(1);
    expect(plans[0]?.highlight).toBe("42 of 500 claimed");
  });
});
