import assert from "node:assert/strict";
import test from "node:test";
import {
  getDevelopmentPremiumAccessOverride,
  hasActivePremiumEntitlement,
} from "./premiumEntitlement.helpers";

const NOW = new Date("2026-07-22T12:00:00.000Z");
const FREE_USER = {
  isPremium: false,
  premiumPlanKey: null,
  premiumExpiresAt: null,
  premiumSource: null,
};
const VERIFIED_PREMIUM_USER = {
  isPremium: true,
  premiumPlanKey: "yearly",
  premiumExpiresAt: "2026-07-23T12:00:00.000Z",
  premiumSource: "revenuecat_verified",
};

test("keeps a verified cancelled trial active until its expiration", () => {
  assert.equal(
    hasActivePremiumEntitlement(
      {
        isPremium: true,
        premiumPlanKey: "yearly",
        premiumExpiresAt: "2026-07-23T12:00:00.000Z",
        premiumSource: "revenuecat_verified",
      },
      NOW
    ),
    true
  );
});

test("expires a verified time-limited entitlement at the stored boundary", () => {
  assert.equal(
    hasActivePremiumEntitlement(
      {
        isPremium: true,
        premiumPlanKey: "yearly",
        premiumExpiresAt: NOW,
        premiumSource: "revenuecat_verified",
      },
      NOW
    ),
    false
  );
});

test("does not authorize legacy client-synced premium state", () => {
  assert.equal(
    hasActivePremiumEntitlement(
      {
        isPremium: true,
        premiumPlanKey: "yearly",
        premiumExpiresAt: null,
        premiumSource: "revenuecat_client_sync",
      },
      NOW
    ),
    false
  );
});

test("keeps a verified lifetime purchase active without an expiration", () => {
  assert.equal(
    hasActivePremiumEntitlement(
      {
        isPremium: true,
        premiumPlanKey: "lifetime",
        premiumExpiresAt: null,
        premiumSource: "revenuecat_verified",
      },
      NOW
    ),
    true
  );
});

test("forces Pro access for an existing user outside production", () => {
  assert.equal(
    hasActivePremiumEntitlement(FREE_USER, NOW, {
      NODE_ENV: "development",
      DEV_PREMIUM_ACCESS_OVERRIDE: "pro",
    }),
    true
  );
});

test("forces free access for a verified Premium user outside production", () => {
  assert.equal(
    hasActivePremiumEntitlement(VERIFIED_PREMIUM_USER, NOW, {
      NODE_ENV: "development",
      DEV_PREMIUM_ACCESS_OVERRIDE: "free",
    }),
    false
  );
});

test("never grants Pro access without an existing user snapshot", () => {
  assert.equal(
    hasActivePremiumEntitlement(null, NOW, {
      NODE_ENV: "development",
      DEV_PREMIUM_ACCESS_OVERRIDE: "pro",
    }),
    false
  );
});

test("production ignores the development override", () => {
  assert.equal(
    hasActivePremiumEntitlement(FREE_USER, NOW, {
      NODE_ENV: "production",
      DEV_PREMIUM_ACCESS_OVERRIDE: "pro",
    }),
    false
  );
  assert.equal(
    hasActivePremiumEntitlement(VERIFIED_PREMIUM_USER, NOW, {
      NODE_ENV: "production",
      DEV_PREMIUM_ACCESS_OVERRIDE: "free",
    }),
    true
  );
});

test("auto, unset, and invalid override values use RevenueCat access", () => {
  for (const configuredOverride of [undefined, "auto", "unexpected"]) {
    const environment = {
      NODE_ENV: "development",
      ...(configuredOverride
        ? { DEV_PREMIUM_ACCESS_OVERRIDE: configuredOverride }
        : {}),
    };

    assert.equal(
      getDevelopmentPremiumAccessOverride(environment),
      "auto"
    );
    assert.equal(
      hasActivePremiumEntitlement(VERIFIED_PREMIUM_USER, NOW, environment),
      true
    );
    assert.equal(
      hasActivePremiumEntitlement(FREE_USER, NOW, environment),
      false
    );
  }
});
