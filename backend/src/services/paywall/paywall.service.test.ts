import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { paywallEventModel } from "../../schema/paywallEvent.schema";
import {
  getMissingDefaultPlacements,
  getMissingTemplatePlacementKeys,
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
    key: "profile_upgrade_banner",
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
        placementKeys: ["profile_upgrade_banner"],
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
        placementKeys: ["profile_upgrade_banner"],
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
    key: "post_auth_exit_offer",
    templateKey: "post-auth-exit-offer",
    fallbackTemplateKey: "weekly-standard",
    enabled: true,
    interruptiveEnabled: false,
    interruptiveTemplateKey: null,
  } as any;

  const templatesByKey = new Map([
    [
      "post-auth-exit-offer",
      {
        key: "post-auth-exit-offer",
        enabled: true,
        featureList: [],
        primaryOfferingKey: "yearly_exit_offer",
        secondaryOfferingKeys: ["monthly"],
        visibleOfferingKeys: ["yearly_exit_offer"],
        fallbackTemplateKey: "weekly-standard",
        placementKeys: ["post_auth_exit_offer"],
      },
    ],
  ]) as any;

  const offeringsByKey = new Map([
    [
      "yearly_exit_offer",
      {
        key: "yearly_exit_offer",
        enabled: true,
        purchasedUsersCount: 0,
        purchaseLimit: null,
        sortOrder: 3,
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

  assert.equal(resolved.template?.key, "post-auth-exit-offer");
  assert.deepEqual(
    resolved.offerings.map(offering => offering.key),
    ["yearly_exit_offer"]
  );
});

test("resolveTemplateForPlacement keeps post-auth-trial on weekly and yearly", () => {
  const placement = {
    key: "post_auth",
    templateKey: "post-auth-trial",
    fallbackTemplateKey: null,
    enabled: true,
    interruptiveEnabled: false,
    interruptiveTemplateKey: null,
  } as any;

  const templatesByKey = new Map([
    [
      "post-auth-trial",
      {
        key: "post-auth-trial",
        enabled: true,
        featureList: [],
        primaryOfferingKey: "weekly",
        secondaryOfferingKeys: ["yearly"],
        visibleOfferingKeys: ["weekly", "yearly"],
        fallbackTemplateKey: "weekly-standard",
        placementKeys: ["post_auth"],
      },
    ],
  ]) as any;

  const offeringsByKey = new Map([
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

  assert.equal(resolved.template?.key, "post-auth-trial");
  assert.deepEqual(
    resolved.offerings.map(offering => offering.key),
    ["weekly", "yearly"]
  );
});

test("resolveTemplateForPlacement keeps privacy export locked on weekly and yearly", () => {
  const placement = {
    key: "privacy_export_locked",
    templateKey: "weekly-standard",
    fallbackTemplateKey: null,
    enabled: true,
    interruptiveEnabled: false,
    interruptiveTemplateKey: null,
  } as any;

  const templatesByKey = new Map([
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
        placementKeys: ["privacy_export_locked"],
      },
    ],
  ]) as any;

  const offeringsByKey = new Map([
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
  assert.deepEqual(
    resolved.offerings.map(offering => offering.key),
    ["weekly", "yearly"]
  );
});

test("getMissingDefaultPlacements returns only placements absent from current config", () => {
  const missing = getMissingDefaultPlacements(
    [
      {
        key: "post_auth",
        templateKey: "post-auth-trial",
        fallbackTemplateKey: null,
        enabled: true,
        interruptiveEnabled: false,
        interruptiveTemplateKey: null,
      },
      {
        key: "settings_privacy_mode_locked",
        templateKey: "weekly-standard",
        fallbackTemplateKey: null,
        enabled: true,
        interruptiveEnabled: false,
        interruptiveTemplateKey: null,
      },
    ] as any,
    [
      {
        key: "post_auth",
        templateKey: "post-auth-trial",
        fallbackTemplateKey: null,
        enabled: true,
        interruptiveEnabled: false,
        interruptiveTemplateKey: null,
      },
      {
        key: "settings_privacy_mode_locked",
        templateKey: "weekly-standard",
        fallbackTemplateKey: null,
        enabled: true,
        interruptiveEnabled: false,
        interruptiveTemplateKey: null,
      },
      {
        key: "privacy_export_locked",
        templateKey: "weekly-standard",
        fallbackTemplateKey: null,
        enabled: true,
        interruptiveEnabled: false,
        interruptiveTemplateKey: null,
      },
    ] as any
  );

  assert.deepEqual(
    missing.map((placement: { key: string }) => placement.key),
    ["privacy_export_locked"]
  );
});

test("getMissingTemplatePlacementKeys returns only missing placement keys", () => {
  const missing = getMissingTemplatePlacementKeys(
    ["post_auth", "settings_privacy_mode_locked", "settings_hide_previews_locked"],
    [
      "post_auth",
      "settings_privacy_mode_locked",
      "settings_hide_previews_locked",
      "privacy_export_locked",
    ]
  );

  assert.deepEqual(missing, ["privacy_export_locked"]);
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
