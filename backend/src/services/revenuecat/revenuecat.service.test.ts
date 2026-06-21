import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  getRevenueCatWebhookEventKey,
  isAllowedRevenueCatWebhookEnvironment,
  isAuthorizedRevenueCatWebhookRequest,
  mapRevenueCatSubscriberState,
  syncAuthenticatedRevenueCatPurchase,
} from "./revenuecat.service";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test("isAuthorizedRevenueCatWebhookRequest matches the configured bearer token", () => {
  process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN = "secret-token";

  assert.equal(
    isAuthorizedRevenueCatWebhookRequest("Bearer secret-token"),
    true
  );
  assert.equal(
    isAuthorizedRevenueCatWebhookRequest("Bearer wrong-token"),
    false
  );
});

test("getRevenueCatWebhookEventKey falls back to a derived legacy key", () => {
  const key = getRevenueCatWebhookEventKey({
    type: "INITIAL_PURCHASE",
    app_user_id: "6654fd0b84ab9d62d19cb123",
    original_app_user_id: "6654fd0b84ab9d62d19cb123",
    product_id: "app.journalio.premium.yearly",
    transaction_id: "100000000000001",
    original_transaction_id: "100000000000001",
    event_timestamp_ms: 1710000000000,
    purchased_at_ms: 1710000000000,
  });

  assert.match(key || "", /^[a-f0-9]{64}$/);
});

test("isAllowedRevenueCatWebhookEnvironment honors the configured allowlist", () => {
  process.env.REVENUECAT_ALLOWED_WEBHOOK_ENVIRONMENTS = "PRODUCTION,SANDBOX";

  assert.equal(isAllowedRevenueCatWebhookEnvironment("PRODUCTION"), true);
  assert.equal(isAllowedRevenueCatWebhookEnvironment("SANDBOX"), true);
  assert.equal(isAllowedRevenueCatWebhookEnvironment("TEST_STORE"), false);
});

test("mapRevenueCatSubscriberState keeps cancelled active premium until expiration", () => {
  const existingUser = {
    isPremium: true,
    premiumActivatedAt: new Date("2026-05-01T09:30:00.000Z"),
    lifetimePurchaseRecordedAt: null,
    premiumRevenueCatRequestDate: null,
  };

  const mapped = mapRevenueCatSubscriberState(
    {
      request_date: "2026-06-21T09:30:00.000Z",
      subscriber: {
        entitlements: {
          "Journal.IO Pro": {
            product_identifier: "app.journalio.premium.yearly",
            purchase_date: "2026-06-01T09:30:00.000Z",
            expires_date: "2026-06-28T09:30:00.000Z",
          },
        },
        subscriptions: {
          "app.journalio.premium.yearly": {
            purchase_date: "2026-06-01T09:30:00.000Z",
            original_purchase_date: "2026-06-01T09:30:00.000Z",
            expires_date: "2026-06-28T09:30:00.000Z",
            unsubscribe_detected_at: "2026-06-20T09:30:00.000Z",
          },
        },
      },
    },
    existingUser as any
  );

  assert.equal(mapped.isPremium, true);
  assert.equal(mapped.planKey, "yearly");
  assert.equal(mapped.willRenew, false);
  assert.equal(
    mapped.premiumActivatedAt?.toISOString(),
    "2026-05-01T09:30:00.000Z"
  );
});

test("mapRevenueCatSubscriberState clears active metadata when an expired entitlement remains in RevenueCat history", () => {
  const mapped = mapRevenueCatSubscriberState(
    {
      request_date: "2026-06-21T09:30:00.000Z",
      subscriber: {
        entitlements: {
          "Journal.IO Pro": {
            product_identifier: "app.journalio.premium.yearly",
            purchase_date: "2026-06-13T09:30:00.000Z",
            expires_date: "2026-06-20T09:30:00.000Z",
          },
        },
        subscriptions: {
          "app.journalio.premium.yearly": {
            purchase_date: "2026-06-13T09:30:00.000Z",
            expires_date: "2026-06-20T09:30:00.000Z",
            unsubscribe_detected_at: "2026-06-14T09:30:00.000Z",
          },
        },
      },
    },
    {
      isPremium: true,
      premiumActivatedAt: new Date("2026-05-01T09:30:00.000Z"),
      lifetimePurchaseRecordedAt: null,
      premiumRevenueCatRequestDate: new Date("2026-06-20T09:30:00.000Z"),
    } as any
  );

  assert.equal(mapped.isPremium, false);
  assert.equal(mapped.planKey, null);
  assert.equal(mapped.productId, null);
  assert.equal(mapped.expiresAt, null);
  assert.equal(mapped.premiumActivatedAt, null);
});

test("mapRevenueCatSubscriberState honors a future billing grace period", () => {
  const mapped = mapRevenueCatSubscriberState(
    {
      request_date: "2026-06-21T09:30:00.000Z",
      subscriber: {
        entitlements: {
          "Journal.IO Pro": {
            product_identifier: "app.journalio.premium.yearly",
            purchase_date: "2026-06-13T09:30:00.000Z",
            expires_date: "2026-06-20T09:30:00.000Z",
            grace_period_expires_date: "2026-06-23T09:30:00.000Z",
          },
        },
        subscriptions: {
          "app.journalio.premium.yearly": {
            purchase_date: "2026-06-13T09:30:00.000Z",
            expires_date: "2026-06-20T09:30:00.000Z",
            grace_period_expires_date: "2026-06-23T09:30:00.000Z",
            billing_issues_detected_at: "2026-06-20T09:30:00.000Z",
          },
        },
      },
    },
    {
      isPremium: true,
      premiumActivatedAt: new Date("2026-06-13T09:30:00.000Z"),
      lifetimePurchaseRecordedAt: null,
      premiumRevenueCatRequestDate: null,
    } as any
  );

  assert.equal(mapped.isPremium, true);
  assert.equal(
    mapped.expiresAt?.toISOString(),
    "2026-06-23T09:30:00.000Z"
  );
});

test("mapRevenueCatSubscriberState revokes a refunded subscription before expiration", () => {
  const mapped = mapRevenueCatSubscriberState(
    {
      request_date: "2026-06-21T09:30:00.000Z",
      subscriber: {
        entitlements: {
          "Journal.IO Pro": {
            product_identifier: "app.journalio.premium.yearly",
            purchase_date: "2026-06-13T09:30:00.000Z",
            expires_date: "2027-06-13T09:30:00.000Z",
          },
        },
        subscriptions: {
          "app.journalio.premium.yearly": {
            purchase_date: "2026-06-13T09:30:00.000Z",
            expires_date: "2027-06-13T09:30:00.000Z",
            refunded_at: "2026-06-20T09:30:00.000Z",
          },
        },
      },
    },
    {
      isPremium: true,
      premiumActivatedAt: new Date("2026-06-13T09:30:00.000Z"),
      lifetimePurchaseRecordedAt: null,
      premiumRevenueCatRequestDate: null,
    } as any
  );

  assert.equal(mapped.isPremium, false);
  assert.equal(mapped.planKey, null);
  assert.equal(mapped.productId, null);
});

test("mapRevenueCatSubscriberState records lifetime purchases without renewal", () => {
  const mapped = mapRevenueCatSubscriberState(
    {
      request_date: "2026-06-21T09:30:00.000Z",
      subscriber: {
        entitlements: {
          "Journal.IO Pro": {
            product_identifier: "app.journalio.premium.lifetime",
            purchase_date: "2026-06-10T09:30:00.000Z",
            expires_date: null,
          },
        },
        non_subscriptions: {
          "app.journalio.premium.lifetime": [
            {
              id: "purchase-1",
              purchase_date: "2026-06-10T09:30:00.000Z",
              store: "app_store",
            },
          ],
        },
      },
    },
    {
      isPremium: false,
      premiumActivatedAt: null,
      lifetimePurchaseRecordedAt: null,
      premiumRevenueCatRequestDate: null,
    } as any
  );

  assert.equal(mapped.isPremium, true);
  assert.equal(mapped.planKey, "lifetime");
  assert.equal(mapped.willRenew, false);
  assert.equal(
    mapped.lifetimePurchaseRecordedAt?.toISOString(),
    "2026-06-10T09:30:00.000Z"
  );
});

test("syncAuthenticatedRevenueCatPurchase retries until server verification becomes premium", async () => {
  let attempts = 0;
  const profile = { userId: "6654fd0b84ab9d62d19cb123", isPremium: true };

  const result = await syncAuthenticatedRevenueCatPurchase(
    "6654fd0b84ab9d62d19cb123",
    {
      retryDelaysMs: [0, 10, 20],
      wait: async () => undefined,
      reconcile: async () => {
        attempts += 1;

        return {
          profile: profile as any,
          requestDate: new Date("2026-06-21T09:30:00.000Z"),
          isPremium: attempts === 3,
          isStale: false,
        };
      },
    }
  );

  assert.equal(attempts, 3);
  assert.equal(result, profile);
});

test("syncAuthenticatedRevenueCatPurchase returns a retryable error instead of a false purchase success", async () => {
  let attempts = 0;

  await assert.rejects(
    syncAuthenticatedRevenueCatPurchase("6654fd0b84ab9d62d19cb123", {
      retryDelaysMs: [0, 10, 20],
      wait: async () => undefined,
      reconcile: async () => {
        attempts += 1;

        return {
          profile: { userId: "6654fd0b84ab9d62d19cb123", isPremium: false } as any,
          requestDate: new Date("2026-06-21T09:30:00.000Z"),
          isPremium: false,
          isStale: false,
        };
      },
    }),
    (error: unknown) => {
      assert.equal(attempts, 3);
      assert.equal(
        error instanceof Error && error.name,
        "RevenueCatServiceError"
      );
      assert.equal((error as any).statusCode, 503);
      assert.equal((error as any).retryable, true);
      assert.equal(
        (error as any).safeErrorCode,
        "revenuecat_purchase_pending"
      );
      return true;
    }
  );
});
