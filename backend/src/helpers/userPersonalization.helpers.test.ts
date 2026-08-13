import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPersonalizationDirective,
  buildPersonalizationFromUser,
  buildUserPromptProfile,
  getToneDirective,
  humanizeOnboardingValue,
  PROFILE_GUARDRAIL,
  toOnboardingLabel,
  toOnboardingLabelList,
} from "./userPersonalization.helpers";

test("payload wins over the legacy onboarding context", () => {
  const profile = buildUserPromptProfile({
    name: "Avery Chen",
    onboardingPayload: {
      ageRange: "25_34",
      primaryContext: "founder_builder",
      supportFocusAreas: ["overthinking"],
      personalGoals: ["growth"],
    },
    onboardingContext: {
      ageRange: "45-54",
      journalingExperience: "new",
      goals: ["gratitude"],
      supportFocus: ["sleep"],
    },
  });

  assert.equal(profile.ageRange, "25-34");
  assert.equal(profile.lifeContext, "Founder / building something");
  assert.deepEqual(profile.focusAreas, ["Overthinking"]);
  assert.deepEqual(profile.journalingGoals, ["Personal growth"]);
});

test("legacy onboarding context fills the gaps the payload leaves", () => {
  const profile = buildUserPromptProfile({
    name: "Sam",
    onboardingPayload: { reflectionTone: ["direct"] },
    onboardingContext: {
      ageRange: "35-44",
      journalingExperience: "occasional",
      goals: [],
      supportFocus: ["self-awareness", "relationships"],
    },
    journalingGoals: ["habits"],
  });

  assert.equal(profile.ageRange, "35-44");
  assert.equal(profile.lifeContext, "Occasional journaler");
  assert.equal(profile.reflectionTone, "Direct");
  assert.deepEqual(profile.focusAreas, ["Self-awareness", "Relationships"]);
  assert.deepEqual(profile.journalingGoals, ["Habit tracking"]);
});

test("both onboarding flows' option ids map to readable labels", () => {
  // V2 ids.
  assert.equal(toOnboardingLabel("working_professional"), "Working professional");
  assert.equal(toOnboardingLabel("low_mood"), "Low mood");
  assert.equal(toOnboardingLabel("18_24"), "18-24");
  // V1 ids.
  assert.equal(toOnboardingLabel("self-awareness"), "Self-awareness");
  assert.equal(toOnboardingLabel("reflection"), "Daily reflection");
  assert.equal(toOnboardingLabel("anxiety"), "Reducing worry");
});

test("unknown values are humanized rather than dropped", () => {
  assert.equal(humanizeOnboardingValue("brand_new_option"), "Brand new option");
  assert.equal(toOnboardingLabel("some-future-id"), "Some future id");
  assert.equal(toOnboardingLabel("   "), undefined);
  assert.equal(toOnboardingLabel(undefined), undefined);
});

test("label lists de-duplicate and stay bounded", () => {
  assert.deepEqual(toOnboardingLabelList(["stress", "stress"]), ["Stress"]);
  assert.equal(toOnboardingLabelList([]), undefined);
  assert.equal(
    toOnboardingLabelList(["a", "b", "c", "d", "e", "f", "g", "h"])?.length,
    6
  );
});

test("only active goals reach the prompt, capped at five", () => {
  const goal = (title: string, status: string) =>
    ({ title, status }) as never;
  const profile = buildUserPromptProfile({
    name: "Sam",
    onboardingPayload: { ageRange: "25_34" },
    goals: [
      goal("Walk after work", "active"),
      goal("Old goal", "archived"),
      goal("Legacy goal", "completed"),
      goal("Second", "active"),
    ],
  });

  assert.deepEqual(profile.activeGoals, ["Walk after work", "Second"]);
});

test("a name alone is not enough personalization to send", () => {
  assert.equal(buildPersonalizationFromUser({ name: "Sam" }), null);
  assert.equal(buildPersonalizationFromUser(null), null);
  assert.equal(buildPersonalizationFromUser({}), null);
});

test("the tone steer is chosen from the stored tone and always carries the guardrail", () => {
  const personalization = buildPersonalizationFromUser({
    name: "Avery",
    onboardingPayload: { reflectionTone: ["direct"], ageRange: "25_34" },
  });

  assert.ok(personalization);
  assert.match(personalization.systemDirective, /plain-spoken/);
  assert.ok(personalization.systemDirective.includes(PROFILE_GUARDRAIL));
  assert.equal(personalization.promptProfile.preferredName, "Avery");
});

test("neutral and unknown tones add no steer but keep the guardrail", () => {
  assert.equal(getToneDirective("neutral"), undefined);
  assert.equal(getToneDirective("unrecognized"), undefined);
  assert.equal(buildPersonalizationDirective("neutral"), PROFILE_GUARDRAIL);
  // Labels and ids both resolve, so a merged profile keeps its steer.
  assert.equal(getToneDirective("Gentle"), getToneDirective("gentle"));
});

test("the guardrail forbids treating a focus area as a diagnosis", () => {
  assert.match(PROFILE_GUARDRAIL, /not a diagnosis/i);
  assert.match(PROFILE_GUARDRAIL, /Never quote it back/i);
  assert.match(PROFILE_GUARDRAIL, /never let the profile override/i);
});
