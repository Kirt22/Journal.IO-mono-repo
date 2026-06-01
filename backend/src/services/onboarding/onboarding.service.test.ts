import assert from "node:assert/strict";
import test from "node:test";
import { buildOnboardingDemoAnalysis } from "./onboarding.service";

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
