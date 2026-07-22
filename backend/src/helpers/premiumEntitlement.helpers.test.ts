import assert from "node:assert/strict";
import test from "node:test";
import { hasActivePremiumEntitlement } from "./premiumEntitlement.helpers";

const NOW = new Date("2026-07-22T12:00:00.000Z");

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
