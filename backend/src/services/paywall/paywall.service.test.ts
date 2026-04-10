import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { paywallEventModel } from "../../schema/paywallEvent.schema";
import {
  resolveTemplateForPlacement,
  shouldAllowInterruptivePaywall,
} from "./paywall.service";

const eventTarget = paywallEventModel as unknown as {
  countDocuments: (query: Record<string, unknown>) => Promise<number>;
};

const originalCountDocuments = eventTarget.countDocuments;

afterEach(() => {
  eventTarget.countDocuments = originalCountDocuments;
});

test("resolveTemplateForPlacement falls back when the lifetime offer is sold out", () => {
  const placement = {
    key: "post_auth",
    templateKey: "lifetime-launch",
    fallbackTemplateKey: "weekly-standard",
    enabled: true,
    interruptiveEnabled: false,
    interruptiveTemplateKey: null,
  } as any;

  const templatesByKey = new Map([
    [
      "lifetime-launch",
      {
        key: "lifetime-launch",
        enabled: true,
        featureList: [],
        primaryOfferingKey: "lifetime",
        secondaryOfferingKeys: [],
        visibleOfferingKeys: ["lifetime"],
        fallbackTemplateKey: "weekly-standard",
      },
    ],
    [
      "weekly-standard",
      {
        key: "weekly-standard",
        enabled: true,
        featureList: [],
        primaryOfferingKey: "weekly",
        secondaryOfferingKeys: ["yearly"],
        visibleOfferingKeys: ["weekly", "yearly"],
        fallbackTemplateKey: null,
      },
    ],
  ]) as any;

  const offeringsByKey = new Map([
    [
      "lifetime",
      {
        key: "lifetime",
        enabled: true,
        purchasedUsersCount: 500,
        purchaseLimit: 500,
        sortOrder: 4,
      },
    ],
    [
      "weekly",
      {
        key: "weekly",
        enabled: true,
        purchasedUsersCount: 0,
        purchaseLimit: null,
        sortOrder: 1,
      },
    ],
    [
      "yearly",
      {
        key: "yearly",
        enabled: true,
        purchasedUsersCount: 0,
        purchaseLimit: null,
        sortOrder: 3,
      },
    ],
  ]) as any;

  const resolved = resolveTemplateForPlacement({
    placement,
    templatesByKey,
    offeringsByKey,
  });

  assert.equal(resolved.template?.key, "weekly-standard");
  assert.equal(resolved.offerings[0]?.key, "weekly");
});

test("resolveTemplateForPlacement uses visibleOfferingKeys to control rendered plans", () => {
  const placement = {
    key: "post_auth",
    templateKey: "lifetime-launch",
    fallbackTemplateKey: "weekly-standard",
    enabled: true,
    interruptiveEnabled: false,
    interruptiveTemplateKey: null,
  } as any;

  const templatesByKey = new Map([
    [
      "lifetime-launch",
      {
        key: "lifetime-launch",
        enabled: true,
        featureList: [],
        primaryOfferingKey: "lifetime",
        secondaryOfferingKeys: ["monthly"],
        visibleOfferingKeys: ["lifetime"],
        fallbackTemplateKey: "weekly-standard",
      },
    ],
  ]) as any;

  const offeringsByKey = new Map([
    [
      "lifetime",
      {
        key: "lifetime",
        enabled: true,
        purchasedUsersCount: 42,
        purchaseLimit: 500,
        sortOrder: 4,
      },
    ],
    [
      "monthly",
      {
        key: "monthly",
        enabled: true,
        purchasedUsersCount: 0,
        purchaseLimit: null,
        sortOrder: 2,
      },
    ],
  ]) as any;

  const resolved = resolveTemplateForPlacement({
    placement,
    templatesByKey,
    offeringsByKey,
  });

  assert.equal(resolved.template?.key, "lifetime-launch");
  assert.deepEqual(
    resolved.offerings.map(offering => offering.key),
    ["lifetime"]
  );
});

test("shouldAllowInterruptivePaywall blocks users below the premium-intent threshold", async () => {
  eventTarget.countDocuments = async query => {
    if (
      typeof query === "object" &&
      query &&
      "wasInterruptive" in query
    ) {
      return 0;
    }

    return 2;
  };

  const result = await shouldAllowInterruptivePaywall({
    userId: "user-123",
    screenKey: "home",
    config: {
      premiumIntentWindowHours: 24,
      premiumIntentThreshold: 3,
      interruptiveCooldownHours: 48,
      interruptiveMaxShowsPer30Days: 3,
      interruptiveProbability: 1,
      interruptiveEligibleScreens: ["home", "insights"],
      interruptiveExcludedStages: ["new-entry"],
    } as any,
  });

  assert.equal(result, "insufficient_premium_intent");
});

test("shouldAllowInterruptivePaywall allows eligible users when thresholds are met", async () => {
  eventTarget.countDocuments = async query => {
    if (
      typeof query === "object" &&
      query &&
      "wasInterruptive" in query
    ) {
      return 1;
    }

    return 4;
  };

  const result = await shouldAllowInterruptivePaywall({
    userId: "user-123",
    screenKey: "home",
    config: {
      premiumIntentWindowHours: 24,
      premiumIntentThreshold: 3,
      interruptiveCooldownHours: 48,
      interruptiveMaxShowsPer30Days: 3,
      interruptiveProbability: 1,
      interruptiveEligibleScreens: ["home", "insights"],
      interruptiveExcludedStages: ["new-entry"],
    } as any,
  });

  assert.equal(result, null);
});
