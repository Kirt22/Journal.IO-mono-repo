import assert from "node:assert/strict";
import test from "node:test";
import { buildUserProfilePayload } from "./user.service";

test("buildUserProfilePayload includes premiumActivatedAt as an ISO string", () => {
  const premiumActivatedAt = new Date("2026-04-16T09:30:00.000Z");
  const premiumExpiresAt = new Date("2026-04-23T09:30:00.000Z");

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
    profilePic: null,
    onboardingContext: {
      goals: [],
      supportFocus: [],
      aiOptIn: true,
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
});
