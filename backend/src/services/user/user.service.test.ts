import assert from "node:assert/strict";
import test from "node:test";
import { buildUserProfilePayload } from "./user.service";

test("buildUserProfilePayload includes premiumActivatedAt as an ISO string", () => {
  const premiumActivatedAt = new Date("2026-04-16T09:30:00.000Z");

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
});
