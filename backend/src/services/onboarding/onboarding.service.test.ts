import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOnboardingDemoAnalysis,
  sanitizeOnboardingCompletionPayload,
} from "./onboarding.service";

test("buildOnboardingDemoAnalysis returns a keyword-aware non-clinical demo reflection", () => {
  const analysis = buildOnboardingDemoAnalysis({
    mood: "okay",
    feeling: "scattered",
    challenge: "too many tabs open",
    thoughts:
      "I felt pulled in too many directions today, but writing it down already feels lighter.",
  });

  assert.equal(analysis.moodTone, "neutral and reflective");
  assert.match(analysis.summary, /"scattered"/);
  assert.match(analysis.summary, /"too many tabs open"/);
  assert.match(analysis.summary, /I noticed/);
  assert.ok(analysis.keywords.some(keyword => keyword.label === "Okay"));
  assert.ok(analysis.keywords.some(keyword => keyword.label === "scattered"));
  assert.ok(analysis.keywords.some(keyword => keyword.label === "too many tabs open"));
  assert.ok(
    analysis.keywords.every(keyword => keyword.description.length > keyword.label.length)
  );
  assert.doesNotMatch(analysis.summary.toLowerCase(), /diagnos|disorder|condition/);
});

test("buildOnboardingDemoAnalysis falls back to mood when optional fields are empty", () => {
  const analysis = buildOnboardingDemoAnalysis({
    mood: "good",
    thoughts: "A short note about getting outside and taking a walk.",
  });

  assert.equal(analysis.moodTone, "calm and steady");
  assert.ok(analysis.keywords.some(keyword => keyword.label === "Good"));
  assert.match(analysis.prompt, /What is one small, gentle thing/);
});

test("sanitizeOnboardingCompletionPayload maps current UI answers to onboarding v2 payload", () => {
  const payload = sanitizeOnboardingCompletionPayload({
    ageRange: " 25-34 ",
    journalingExperience: " occasional journaler ",
    goals: ["Daily Reflection", "Daily Reflection", "Growth"],
    supportFocusAreas: ["Stress", "Sleep"],
    reminderPreference: "Evening",
    aiComfort: true,
    privacyConsent: true,
  });

  assert.equal(payload.version, 2);
  assert.equal(payload.ageRange, "25-34");
  assert.equal(payload.primaryContext, "occasional journaler");
  assert.deepEqual(payload.personalGoals, ["Daily Reflection", "Growth"]);
  assert.deepEqual(payload.supportFocusAreas, ["Stress", "Sleep"]);
  assert.equal(payload.reminderPreference, "Evening");
  assert.equal(payload.aiComfort, true);
  assert.equal(payload.privacyConsent, true);
});
