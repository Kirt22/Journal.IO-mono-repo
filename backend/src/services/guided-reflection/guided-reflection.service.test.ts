import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { userModel } from "../../schema/user.schema";
import {
  type BrainSessionMap,
  createFirstReflectionSummary,
  createGuidedReflectionGoDeeper,
  createGuidedReflectionGoalSuggestions,
  createGuidedReflectionSessionAnalysis,
} from "./guided-reflection.service";

type FindByIdQueryResult<T> = {
  select: () => {
    lean: () => {
      exec: () => Promise<T>;
    };
  };
};

const userTarget = userModel as unknown as {
  findById: (userId: string) => FindByIdQueryResult<unknown>;
};

const originalFindById = userTarget.findById;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalFetch = globalThis.fetch;

const assertValidBrainSessionMap = (brainSessionMap: BrainSessionMap) => {
  assert.equal(brainSessionMap.centers.length, 8);
  assert.ok(brainSessionMap.dominantCenterId);
  assert.equal(brainSessionMap.dominantCenter.id, brainSessionMap.dominantCenterId);
  assert.ok(brainSessionMap.secondaryCenters.length >= 1);
  assert.ok(brainSessionMap.secondaryCenters.length <= 3);
  assert.deepEqual(
    brainSessionMap.secondaryCenterIds,
    brainSessionMap.secondaryCenters.map(center => center.id)
  );

  const centerIds = new Set(brainSessionMap.centers.map(center => center.id));
  assert.equal(centerIds.size, 8);

  for (const [index, center] of brainSessionMap.centers.entries()) {
    assert.equal(center.rank, index + 1);
    assert.ok(center.score >= 0 && center.score <= 1);
    assert.ok(center.confidence >= 0 && center.confidence <= 1);
    assert.ok(["low", "moderate", "high"].includes(center.intensity));
    assert.ok(center.productName);
    assert.ok(center.brainRegion);
    assert.ok(center.shortInsight);
  }

  assert.equal(
    brainSessionMap.dominantCenter.score,
    Math.max(...brainSessionMap.centers.map(center => center.score))
  );
  assert.ok(new Set(brainSessionMap.centers.map(center => center.score)).size > 1);
  assert.ok(brainSessionMap.neuroscienceSummary);
  assert.ok(brainSessionMap.mostNoticedText);
  assert.ok(brainSessionMap.mindMapSeedText);
};

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: false,
          onboardingContext: {
            aiOptIn: true,
          },
        }),
      }),
    }),
  });
});

afterEach(() => {
  userTarget.findById = originalFindById;
  globalThis.fetch = originalFetch;

  if (typeof originalApiKey === "string") {
    process.env.OPENAI_API_KEY = originalApiKey;
  } else {
    delete process.env.OPENAI_API_KEY;
  }
});

test("createFirstReflectionSummary returns an ungated non-clinical first reflection", async () => {
  const summary = await createFirstReflectionSummary({
    userId: "free-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "What was one good or exciting thing that happened today?",
        answer: "I woke up early",
      },
      {
        questionId: "hurdle",
        question: "What was one hurdle or stressful moment you faced today?",
        answer: "I masturbated",
      },
      {
        questionId: "carry_tomorrow",
        question: "What would you like to carry into tomorrow?",
        answer: "My dad's perception of me",
      },
    ],
    onboardingContext: {
      reflectionTone: ["gentle"],
    },
  });

  assert.match(summary.reflection, /woke up early/i);
  assert.match(summary.reflection, /masturbated/i);
  assert.match(summary.reflection, /dad's perception/i);
  assert.doesNotMatch(
    summary.reflection.toLowerCase(),
    /addiction|disorder|diagnos|shame|failed/
  );
});

test("createGuidedReflectionGoDeeper returns a short deeper response without premium", async () => {
  const response = await createGuidedReflectionGoDeeper({
    userId: "free-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "What was one good or exciting thing that happened today?",
        answer: "A good walk",
      },
      {
        questionId: "hurdle",
        question: "What was one hurdle or stressful moment you faced today?",
        answer: "I felt behind on work",
      },
      {
        questionId: "carry_tomorrow",
        question: "What would you like to carry into tomorrow?",
        answer: "One focused hour",
      },
    ],
    aiSummary:
      "Today held a good walk and some pressure around work. Keep tomorrow simple.",
    previousDeeperReflections: [],
    currentText: "I think I need to protect my morning better.",
    onboardingContext: {
      reflectionTone: ["practical"],
    },
  });

  assert.match(response.reflection, /protect my morning/i);
  assert.ok(response.followUpPrompt);
  assert.doesNotMatch(response.reflection.toLowerCase(), /diagnos|disorder|condition/);
});

test("createGuidedReflectionGoDeeper responds to suggestion actions without premium", async () => {
  const response = await createGuidedReflectionGoDeeper({
    userId: "free-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "What was one good or exciting thing that happened today?",
        answer: "I stuck to my diet",
      },
      {
        questionId: "hurdle",
        question: "What was one hurdle or stressful moment you faced today?",
        answer: "I felt judged by my dad",
      },
      {
        questionId: "carry_tomorrow",
        question: "What would you like to carry into tomorrow?",
        answer: "Discipline",
      },
    ],
    aiSummary:
      "Today held discipline and the discomfort of feeling judged. Keep tomorrow steady.",
    threadMessages: [
      {
        role: "user",
        kind: "suggestion_request",
        text: "Offer another perspective.",
        actionType: "another_perspective",
      },
    ],
    currentText: "Offer another perspective.",
    suggestionAction: "another_perspective",
    onboardingContext: {
      reflectionTone: ["gentle"],
    },
  });

  assert.match(response.reflection, /Another way to see this/i);
  assert.doesNotMatch(
    response.reflection.toLowerCase(),
    /trauma|addiction|disorder|diagnos|shame|failed/
  );
});

test("createFirstReflectionSummary returns low-signal copy for gibberish prompt answers", async () => {
  const summary = await createFirstReflectionSummary({
    userId: "free-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "What was one good or exciting thing that happened today?",
        answer: "asdf qwer zzzzz",
      },
      {
        questionId: "hurdle",
        question: "What was one hurdle or stressful moment you faced today?",
        answer: "sjdhdh lksdjf hhhhh",
      },
      {
        questionId: "carry_tomorrow",
        question: "What would you like to carry into tomorrow?",
        answer: "asdfgh zxcvbn",
      },
    ],
    onboardingContext: {},
  });

  assert.match(summary.reflection, /not have enough clear information/i);
});

test("createGuidedReflectionGoDeeper returns low-signal copy for gibberish sessions", async () => {
  const response = await createGuidedReflectionGoDeeper({
    userId: "free-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "What was one good or exciting thing that happened today?",
        answer: "asdf qwer zzzzz",
      },
      {
        questionId: "hurdle",
        question: "What was one hurdle or stressful moment you faced today?",
        answer: "sjdhdh lksdjf hhhhh",
      },
      {
        questionId: "carry_tomorrow",
        question: "What would you like to carry into tomorrow?",
        answer: "asdfgh zxcvbn",
      },
    ],
    currentText: "go deeper",
    onboardingContext: {},
  });

  assert.match(response.reflection, /not have enough clear information/i);
});

test("createGuidedReflectionSessionAnalysis returns a meaningful ungated session analysis", async () => {
  const analysis = await createGuidedReflectionSessionAnalysis({
    userId: "free-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "What was one good or exciting thing that happened today?",
        answer: "I stayed disciplined with my morning routine",
      },
      {
        questionId: "hurdle",
        question: "What was one hurdle or stressful moment you faced today?",
        answer: "I felt pressure from my dad and worried I was being judged",
      },
      {
        questionId: "carry_tomorrow",
        question: "What would you like to carry into tomorrow?",
        answer: "I want to carry discipline without turning it into pressure",
      },
    ],
    aiSummary:
      "Today shows discipline alongside the discomfort of feeling judged. The steadier path is to keep tomorrow grounded in one choice.",
    threadMessages: [
      {
        role: "user",
        kind: "suggestion_request",
        text: "Offer another perspective.",
        actionType: "another_perspective",
      },
      {
        role: "assistant",
        kind: "assistant_reflection",
        text: "Another perspective is that this was also about proving steadiness to yourself.",
      },
    ],
    onboardingContext: {
      reflectionTone: ["deep"],
    },
  });

  assert.equal(analysis.hasEnoughSignal, true);
  assert.match(analysis.analysis, /discipline|pressure|judged|steady/i);
  assert.match(analysis.majorInsight, /Major insight:/i);
  assert.ok(analysis.observedTrends.length >= 2);
  assert.deepEqual(analysis.topicsObserved, analysis.observedTrends);
  assertValidBrainSessionMap(analysis.brainSessionMap);
  assert.equal(analysis.brainSessionMap.dominantCenterId, "planning_self_control");
  assert.equal(
    analysis.brainSessionMap.dominantCenter.productName,
    "Planning & Self-Control"
  );
  assert.equal(analysis.brainSessionMap.dominantCenter.brainRegion, "Prefrontal Cortex");
  assert.ok(
    analysis.brainSessionMap.secondaryCenterIds.includes("relationships_perspective")
  );
  assert.ok(
    analysis.brainSessionMap.dominantCenter.evidence.some(item =>
      /disciplin|routine|carry/i.test(item)
    )
  );
  assert.doesNotMatch(analysis.analysis.toLowerCase(), /diagnos|disorder|therapy/);
  assert.ok(analysis.analysis.length <= 680);
  assert.ok(analysis.majorInsight.length <= 180);
  assert.ok(analysis.brainSessionMap.neuroscienceSummary.length <= 240);
  assert.ok(analysis.brainSessionMap.mostNoticedText.length <= 220);
  for (const center of analysis.brainSessionMap.centers) {
    assert.ok(center.shortInsight.length <= 180);
    assert.ok(center.evidence.length <= 3);
    assert.ok(center.evidence.every(item => item.length <= 48));
  }
});

test("createGuidedReflectionSessionAnalysis uses the Terra high-reasoning override", async () => {
  const input = {
    userId: "premium-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "What was one good or exciting thing that happened today?",
        answer: "I protected an hour for a focused walk after work.",
      },
      {
        questionId: "hurdle",
        question: "What was one hurdle or stressful moment you faced today?",
        answer: "I felt pressure when a deadline moved earlier than expected.",
      },
      {
        questionId: "carry_tomorrow",
        question: "What would you like to carry into tomorrow?",
        answer: "I want to keep one task small enough to finish calmly.",
      },
    ],
    onboardingContext: {
      reflectionTone: ["practical"],
    },
  } satisfies Parameters<typeof createGuidedReflectionSessionAnalysis>[0];
  const fallback = await createGuidedReflectionSessionAnalysis(input);
  let requestBody: Record<string, unknown> | null = null;

  process.env.OPENAI_API_KEY = "test-key";
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: true,
          onboardingContext: { aiOptIn: true },
        }),
      }),
    }),
  });
  globalThis.fetch = (async (_url, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

    return new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          analysis:
            "This reflection suggests that focused movement helped create steadiness while the earlier deadline added pressure. The clearest pattern is a wish to protect calm progress instead of responding to urgency with more urgency. Keeping tomorrow's task deliberately small may support that direction without making the day feel over-controlled.",
          majorInsight:
            "The clearest signal is choosing calm, bounded progress when pressure rises.",
          observedTrends: ["Focus", "Pressure", "Calm progress"],
          topicsObserved: ["Focus", "Pressure", "Calm progress"],
          brainSessionMap: fallback.brainSessionMap,
        }),
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  const analysis = await createGuidedReflectionSessionAnalysis(input);

  const capturedRequestBody = requestBody as Record<string, unknown> | null;
  assert.ok(capturedRequestBody);
  assert.equal(capturedRequestBody.model, "gpt-5.6-terra");
  assert.deepEqual(capturedRequestBody.reasoning, { effort: "high" });
  assert.equal(analysis.hasEnoughSignal, true);
  assert.match(analysis.analysis, /focused movement|steadiness/i);
});

test("createGuidedReflectionSessionAnalysis handles gibberish without inventing insight", async () => {
  const analysis = await createGuidedReflectionSessionAnalysis({
    userId: "free-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "What was one good or exciting thing that happened today?",
        answer: "asdf qwer zzzz",
      },
      {
        questionId: "hurdle",
        question: "What was one hurdle or stressful moment you faced today?",
        answer: "lksdjf 9999 ////",
      },
      {
        questionId: "carry_tomorrow",
        question: "What would you like to carry into tomorrow?",
        answer: "aaaaa bbbbb ccccc",
      },
    ],
    aiSummary: "",
    threadMessages: [],
    onboardingContext: {},
  });

  assert.equal(analysis.hasEnoughSignal, false);
  assert.match(analysis.analysis, /not enough clear information/i);
  assert.match(analysis.majorInsight, /not enough clear detail/i);
  assert.deepEqual(analysis.observedTrends, [
    "More detail needed",
    "Reflection started",
    "Tomorrow",
  ]);
  assertValidBrainSessionMap(analysis.brainSessionMap);
  assert.equal(analysis.brainSessionMap.dominantCenterId, "self_reflection_identity");
  assert.equal(analysis.brainSessionMap.centers[0]?.score, 0.55);
  assert.equal(
    analysis.brainSessionMap.mindMapSeedText,
    "Your first reflection has added its first signal to your Mind Map."
  );
});

test("createGuidedReflectionSessionAnalysis treats keyboard-smash mixed input as low signal", async () => {
  const analysis = await createGuidedReflectionSessionAnalysis({
    userId: "free-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "What was one good or exciting thing that happened today?",
        answer: "nothing asdf qwer zzzzz",
      },
      {
        questionId: "hurdle",
        question: "What was one hurdle or stressful moment you faced today?",
        answer: "sjdhdh lksdjf hhhhh qwer",
      },
      {
        questionId: "carry_tomorrow",
        question: "What would you like to carry into tomorrow?",
        answer: "idk asdfgh zxcvbn",
      },
    ],
    aiSummary:
      "Today seems to include nothing specific enough to understand yet, but you started the reflection.",
    threadMessages: [
      {
        role: "user",
        kind: "suggestion_request",
        text: "Summarize what I wrote.",
        actionType: "summarize",
      },
    ],
    onboardingContext: {},
  });

  assert.equal(analysis.hasEnoughSignal, false);
  assert.match(analysis.analysis, /not enough clear information/i);
  assertValidBrainSessionMap(analysis.brainSessionMap);
  assert.equal(analysis.brainSessionMap.dominantCenterId, "self_reflection_identity");
});

test("createGuidedReflectionGoalSuggestions returns ungated practical goals", async () => {
  const suggestions = await createGuidedReflectionGoalSuggestions({
    userId: "free-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "What was one good or exciting thing that happened today?",
        answer: "I stayed disciplined with my routine",
      },
      {
        questionId: "hurdle",
        question: "What was one hurdle or stressful moment you faced today?",
        answer: "I felt pressure from work",
      },
      {
        questionId: "carry_tomorrow",
        question: "What would you like to carry into tomorrow?",
        answer: "One steady choice",
      },
    ],
    aiSummary:
      "Today showed discipline and pressure. The next step is to keep one steady choice small.",
    sessionAnalysis: {
      analysis:
        "The session suggests a pattern around discipline, pressure, and one steady next step.",
      majorInsight:
        "Major insight: the clearest signal is choosing steadiness without turning it into pressure.",
      observedTrends: ["Discipline", "Pressure", "Tomorrow"],
      hasEnoughSignal: true,
    },
    onboardingContext: {
      reflectionTone: ["practical"],
    },
  });

  assert.equal(suggestions.hasEnoughSignal, true);
  assert.ok(suggestions.goals.length <= 4);
  assert.ok(suggestions.goals.length >= 1);
  const firstGoal = suggestions.goals[0];
  assert.ok(firstGoal);
  assert.match(firstGoal.title, /steady|pressure|write|name|5-minute/i);
  assert.match(
    suggestions.goals.map(goal => goal.description).join(" "),
    /five-minute|before noon|when pressure rises|after dinner/i
  );
  for (const goal of suggestions.goals) {
    assert.ok(goal.title.length <= 30);
    assert.ok(goal.description.length <= 96);
  }
  assert.doesNotMatch(
    suggestions.goals.map(goal => `${goal.title} ${goal.description}`).join(" ").toLowerCase(),
    /diagnos|disorder|therapy|treatment|addiction/
  );
});

test("createGuidedReflectionGoalSuggestions falls back for low-signal sessions", async () => {
  const suggestions = await createGuidedReflectionGoalSuggestions({
    userId: "free-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "What was one good or exciting thing that happened today?",
        answer: "asdf qwer",
      },
      {
        questionId: "hurdle",
        question: "What was one hurdle or stressful moment you faced today?",
        answer: "lksdjf zzzzz",
      },
      {
        questionId: "carry_tomorrow",
        question: "What would you like to carry into tomorrow?",
        answer: "qwer asdf",
      },
    ],
    sessionAnalysis: {
      analysis: "There is not enough clear information in this session.",
      majorInsight:
        "Major insight: there is not enough clear detail yet to identify a reliable pattern.",
      observedTrends: ["More detail needed", "Reflection started", "Tomorrow"],
      hasEnoughSignal: false,
    },
    onboardingContext: {},
  });

  assert.equal(suggestions.hasEnoughSignal, false);
  assert.ok(suggestions.goals.length >= 1);
  assert.ok(suggestions.goals.length <= 3);
  const firstGoal = suggestions.goals[0];
  assert.ok(firstGoal);
  assert.match(firstGoal.title, /write|notice|carry/i);
});
