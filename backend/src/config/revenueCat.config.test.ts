import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { assertRevenueCatProductionConfiguration } from "./revenueCat.config";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test("RevenueCat production configuration fails closed when secrets are missing", () => {
  process.env.NODE_ENV = "production";
  delete process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN;
  delete process.env.REVENUECAT_SECRET_API_KEY;
  delete process.env.REVENUECAT_APP_ID;

  assert.throws(
    () => assertRevenueCatProductionConfiguration(),
    /REVENUECAT_WEBHOOK_AUTH_TOKEN.*REVENUECAT_SECRET_API_KEY.*REVENUECAT_APP_ID/
  );
});

test("RevenueCat production configuration accepts all required values", () => {
  process.env.NODE_ENV = "production";
  process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN = "webhook-token";
  process.env.REVENUECAT_SECRET_API_KEY = "secret-api-key";
  process.env.REVENUECAT_APP_ID = "app-id";

  assert.doesNotThrow(() => assertRevenueCatProductionConfiguration());
});

test("RevenueCat production configuration does not block local development", () => {
  process.env.NODE_ENV = "development";
  delete process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN;
  delete process.env.REVENUECAT_SECRET_API_KEY;
  delete process.env.REVENUECAT_APP_ID;

  assert.doesNotThrow(() => assertRevenueCatProductionConfiguration());
});
