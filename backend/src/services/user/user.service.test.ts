import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { journalModel } from "../../schema/journal.schema";
import { reminderModel } from "../../schema/reminder.schema";
import {
  buildAuthenticatedUserProfilePayload,
  buildUserProfilePayload,
} from "./user.service";

type ModelQuery = Record<string, unknown>;

const journalTarget = journalModel as unknown as {
  exists: (query: ModelQuery) => Promise<unknown>;
  countDocuments: (query: ModelQuery) => Promise<number>;
};
const reminderTarget = reminderModel as unknown as {
  exists: (query: ModelQuery) => Promise<unknown>;
};

const originalJournalExists = journalTarget.exists;
const originalJournalCountDocuments = journalTarget.countDocuments;
const originalReminderExists = reminderTarget.exists;
const originalNodeEnv = process.env.NODE_ENV;
const originalPremiumAccessOverride =
  process.env.DEV_PREMIUM_ACCESS_OVERRIDE;

afterEach(() => {
  journalTarget.exists = originalJournalExists;
  journalTarget.countDocuments = originalJournalCountDocuments;
  reminderTarget.exists = originalReminderExists;

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalPremiumAccessOverride === undefined) {
    delete process.env.DEV_PREMIUM_ACCESS_OVERRIDE;
  } else {
    process.env.DEV_PREMIUM_ACCESS_OVERRIDE =
      originalPremiumAccessOverride;
  }
});

test("buildUserProfilePayload includes premiumActivatedAt as an ISO string", () => {
  const premiumActivatedAt = new Date("2026-04-16T09:30:00.000Z");
  const premiumExpiresAt = new Date("2099-04-23T09:30:00.000Z");

  const payload = buildUserProfilePayload({
    _id: {
      toString: () => "user-1",
    },
    name: "Journal User",
    phoneNumber: null,
    email: "journal@example.com",
    isPremium: true,
    premiumPlanKey: "yearly",
    premiumActivatedAt,
    premiumProductId: "app.journalio.premium.yearly",
    premiumExpiresAt,
    premiumWillRenew: false,
    premiumVerifiedAt: premiumActivatedAt,
    premiumRevenueCatRequestDate: premiumActivatedAt,
    revenueCatAppUserId: "user-1",
    premiumSource: "revenuecat_verified",
    avatarColor: null,
    journalingGoals: ["Reflection"],
    profileSetupCompleted: true,
    onboardingCompleted: true,
    onboardingVersion: 2,
    onboardingCompletedAt: premiumActivatedAt,
    profilePic: null,
    onboardingContext: {
      ageRange: "25-34",
      journalingExperience: "A few times a week",
      goals: [],
      supportFocus: ["Focus"],
      reminderPreference: "evening",
    },
    onboardingPayload: {
      whatBringsYouHere: ["Build consistency"],
      supportFocusAreas: ["Focus"],
      reflectionTone: ["Gentle"],
    },
  } as any);

  assert.equal(payload.userId, "user-1");
  assert.equal(payload.isPremium, true);
  assert.equal(payload.premiumPlanKey, "yearly");
  assert.equal(payload.premiumActivatedAt, premiumActivatedAt.toISOString());
  assert.equal(payload.premiumProductId, "app.journalio.premium.yearly");
  assert.equal(payload.premiumExpiresAt, premiumExpiresAt.toISOString());
  assert.equal(payload.premiumWillRenew, false);
  assert.equal(payload.revenueCatAppUserId, "user-1");
  assert.equal(payload.premiumSource, "revenuecat_verified");
  assert.equal(payload.onboardingVersion, 2);
  assert.equal(payload.onboardingCompletedAt, premiumActivatedAt.toISOString());
  assert.equal(payload.hasJournalEntries, false);
  assert.deepEqual(payload.onboardingPreferences, {
    ageRange: "25-34",
    journalingExperience: "A few times a week",
    whatBringsYouHere: ["Build consistency"],
    supportFocusAreas: ["Focus"],
    reflectionTone: ["Gentle"],
    reminderPreference: "evening",
  });
});

test("buildUserProfilePayload projects effective development Pro access without mutating stored entitlement data", () => {
  process.env.NODE_ENV = "development";
  process.env.DEV_PREMIUM_ACCESS_OVERRIDE = "pro";

  const user = {
    _id: {
      toString: () => "user-dev-pro",
    },
    name: "Development User",
    phoneNumber: null,
    email: "dev@example.com",
    isPremium: false,
    premiumPlanKey: null,
    premiumActivatedAt: null,
    premiumProductId: null,
    premiumExpiresAt: null,
    premiumWillRenew: null,
    premiumVerifiedAt: null,
    premiumRevenueCatRequestDate: null,
    revenueCatAppUserId: null,
    premiumSource: null,
    avatarColor: null,
    journalingGoals: [],
    profileSetupCompleted: true,
    onboardingCompleted: true,
    onboardingVersion: 2,
    onboardingCompletedAt: new Date("2026-07-22T12:00:00.000Z"),
    profilePic: null,
    onboardingContext: {
    },
    onboardingPayload: null,
  } as any;

  const payload = buildUserProfilePayload(user);

  assert.equal(payload.isPremium, true);
  assert.equal(payload.premiumPlanKey, null);
  assert.equal(payload.premiumSource, null);
  assert.equal(user.isPremium, false);
  assert.equal(user.premiumPlanKey, null);
  assert.equal(user.premiumSource, null);
});

test("buildAuthenticatedUserProfilePayload lazily migrates existing users with journal entries", async () => {
  journalTarget.exists = async () => ({ _id: "journal-1" });
  journalTarget.countDocuments = async () => 3;
  reminderTarget.exists = async () => null;

  let saveCount = 0;
  const user = {
    _id: {
      toString: () => "user-1",
    },
    name: "Journal User",
    phoneNumber: null,
    email: "journal@example.com",
    isPremium: false,
    premiumPlanKey: null,
    premiumActivatedAt: null,
    premiumProductId: null,
    premiumExpiresAt: null,
    premiumWillRenew: null,
    premiumVerifiedAt: null,
    premiumRevenueCatRequestDate: null,
    revenueCatAppUserId: null,
    premiumSource: null,
    avatarColor: null,
    journalingGoals: [],
    profileSetupCompleted: true,
    onboardingCompleted: false,
    onboardingVersion: null,
    onboardingCompletedAt: null,
    onboardingPayload: null,
    profilePic: null,
    onboardingContext: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-02T00:00:00.000Z"),
    save: async () => {
      saveCount += 1;
      return user;
    },
  } as any;

  const payload = await buildAuthenticatedUserProfilePayload(user);

  assert.equal(saveCount, 1);
  assert.equal(user.onboardingCompleted, true);
  assert.equal(user.onboardingVersion, 2);
  assert.equal(user.onboardingPayload.migratedFromLegacy, true);
  assert.equal(payload.onboardingCompleted, true);
  assert.equal(payload.onboardingVersion, 2);
  assert.equal(payload.hasJournalEntries, true);
  assert.equal(payload.journalCount, 3);
});

test("buildAuthenticatedUserProfilePayload leaves genuinely new users incomplete", async () => {
  journalTarget.exists = async () => null;
  journalTarget.countDocuments = async () => 0;
  reminderTarget.exists = async () => null;

  let saveCount = 0;
  const user = {
    _id: {
      toString: () => "user-2",
    },
    name: "New User",
    phoneNumber: null,
    email: "new@example.com",
    isPremium: false,
    premiumPlanKey: null,
    premiumActivatedAt: null,
    premiumProductId: null,
    premiumExpiresAt: null,
    premiumWillRenew: null,
    premiumVerifiedAt: null,
    premiumRevenueCatRequestDate: null,
    revenueCatAppUserId: null,
    premiumSource: null,
    avatarColor: null,
    journalingGoals: [],
    profileSetupCompleted: false,
    onboardingCompleted: false,
    onboardingVersion: null,
    onboardingCompletedAt: null,
    onboardingPayload: null,
    profilePic: null,
    onboardingContext: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    save: async () => {
      saveCount += 1;
      return user;
    },
  } as any;

  const payload = await buildAuthenticatedUserProfilePayload(user);

  assert.equal(saveCount, 0);
  assert.equal(payload.onboardingCompleted, false);
  assert.equal(payload.onboardingVersion, null);
  assert.equal(payload.hasJournalEntries, false);
  assert.equal(payload.journalCount, 0);
});
