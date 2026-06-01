import assert from "node:assert/strict";
import test from "node:test";
import { createOnboardingDemoAnalysisSchema } from "./onboarding.validators";

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
