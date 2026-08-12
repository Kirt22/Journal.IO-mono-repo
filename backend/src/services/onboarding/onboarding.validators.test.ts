import assert from "node:assert/strict";
import test from "node:test";
import {
  completeOnboardingBodySchema,
  createOnboardingDemoAnalysisSchema,
} from "./onboarding.validators";

test("createOnboardingDemoAnalysisSchema accepts a valid demo analysis request", () => {
  const result = createOnboardingDemoAnalysisSchema.safeParse({
    body: {
      mood: "okay",
      feeling: "scattered",
      challenge: "too many tabs open",
      thoughts: "I felt pulled in too many directions today.",
    },
  });

  assert.equal(result.success, true);
});

test("createOnboardingDemoAnalysisSchema rejects missing mood or thoughts", () => {
  const result = createOnboardingDemoAnalysisSchema.safeParse({
    body: {
      feeling: "scattered",
      thoughts: "",
    },
  });

  assert.equal(result.success, false);
});

test("completeOnboardingBodySchema accepts an ISO commitment timestamp", () => {
  const result = completeOnboardingBodySchema.safeParse({
    version: 2,
    commitmentSignedAt: "2026-08-09T10:15:00.000Z",
  });

  assert.equal(result.success, true);
});

test("completeOnboardingBodySchema rejects a non-ISO commitment timestamp", () => {
  const result = completeOnboardingBodySchema.safeParse({
    version: 2,
    commitmentSignedAt: "9 August 2026",
  });

  assert.equal(result.success, false);
});
