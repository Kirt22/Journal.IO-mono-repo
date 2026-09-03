import assert from "node:assert/strict";
import test from "node:test";
import {
  syncPaywallEntitlementSchema,
  syncPaywallPurchaseSchema,
  trackPaywallEventSchema,
} from "./paywall.validators";

test("syncPaywallPurchaseSchema accepts the legacy iOS purchase payload", () => {
  const result = syncPaywallPurchaseSchema.safeParse({
    body: {
      offeringKey: "yearly",
      revenueCatOfferingId: "journalio_offering_other_screens_standard",
      revenueCatPackageId: "$rc_annual",
      store: "APP_STORE",
      entitlementId: "Journal.IO Pro",
      wasRestore: false,
    },
  });

  assert.equal(result.success, true);
});

test("syncPaywallEntitlementSchema accepts current clients without a body", () => {
  const result = syncPaywallEntitlementSchema.safeParse({});

  assert.equal(result.success, true);
});

test("trackPaywallEventSchema rejects unknown template keys", () => {
  const result = trackPaywallEventSchema.safeParse({
    body: {
      placementKey: "profile",
      eventType: "paywall_impression",
      templateKey: "unknown-template",
    },
  });

  assert.equal(result.success, false);
});
