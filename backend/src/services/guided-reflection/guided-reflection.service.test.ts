import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { userModel } from "../../schema/user.schema";
import { clearUserPersonalizationCache } from "../../helpers/userPersonalization.helpers";
import { isThirdPersonVoice } from "../../helpers/emotionalTrigger.helpers";
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

type FindOneAndUpdateQueryResult<T> = {
  lean: () => {
    exec: () => Promise<T>;
  };
};

const userTarget = userModel as unknown as {
  findById: (userId: string) => FindByIdQueryResult<unknown>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => FindOneAndUpdateQueryResult<unknown>;
};

const originalFindById = userTarget.findById;
const originalFindOneAndUpdate = userTarget.findOneAndUpdate;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalNodeEnv = process.env.NODE_ENV;
const originalPremiumAccessOverride =
  process.env.DEV_PREMIUM_ACCESS_OVERRIDE;
const originalFetch = globalThis.fetch;

const getWordCount = (value: string) =>
  value.trim().split(/\s+/).filter(Boolean).length;

// Tracks the ceiling in conciseReflectionSchema. Reflections are allowed more
// room than they once were so they can name a conclusion and a specific next
// step instead of gesturing at both, but they still must not sprawl.
const assertConciseReflection = (value: string) => {
  assert.ok(getWordCount(value) <= 90);
};

const assertConciseQuestion = (value: string) => {
  const wordCount = getWordCount(value);
  // Mirrors conciseQuestionSchema's floor. Asserting a stricter bound here than
  // the parser enforces would let a regression that ships fallback copy pass.
  assert.ok(wordCount >= 4);
  assert.ok(wordCount <= 14);
  assert.ok(value.length <= 100);
};

const assertValidBrainSessionMap = (brainSessionMap: BrainSessionMap) => {
  assert.equal(brainSessionMap.centers.length, 8);
  assert.ok(brainSessionMap.dominantCenterId);
  assert.equal(
    brainSessionMap.dominantCenter.id,
    brainSessionMap.dominantCenterId
  );
  assert.ok(brainSessionMap.secondaryCenters.length >= 1);
  assert.ok(brainSessionMap.secondaryCenters.length <= 3);
  assert.deepEqual(
    brainSessionMap.secondaryCenterIds,
    brainSessionMap.secondaryCenters.map((center) => center.id)
  );

  const centerIds = new Set(brainSessionMap.centers.map((center) => center.id));
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
    Math.max(...brainSessionMap.centers.map((center) => center.score))
  );
  assert.ok(
    new Set(brainSessionMap.centers.map((center) => center.score)).size > 1
  );
  assert.ok(brainSessionMap.neuroscienceSummary);
  assert.ok(brainSessionMap.mostNoticedText);
  assert.ok(brainSessionMap.mindMapSeedText);
};

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.DEV_PREMIUM_ACCESS_OVERRIDE;
  // The personalization profile is cached per user id, and these tests reuse
  // ids across differently-stubbed users.
  clearUserPersonalizationCache();
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: false,
          onboardingContext: {
          },
        }),
      }),
    }),
  });
});

afterEach(() => {
  userTarget.findById = originalFindById;
  userTarget.findOneAndUpdate = originalFindOneAndUpdate;
  globalThis.fetch = originalFetch;

  if (typeof originalApiKey === "string") {
    process.env.OPENAI_API_KEY = originalApiKey;
  } else {
    delete process.env.OPENAI_API_KEY;
  }
  if (typeof originalNodeEnv === "string") {
    process.env.NODE_ENV = originalNodeEnv;
  } else {
    delete process.env.NODE_ENV;
  }
  if (typeof originalPremiumAccessOverride === "string") {
    process.env.DEV_PREMIUM_ACCESS_OVERRIDE = originalPremiumAccessOverride;
  } else {
    delete process.env.DEV_PREMIUM_ACCESS_OVERRIDE;
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
  assert.match(summary.reflection, /deserves slightly more attention/i);
  assert.match(summary.reflection, /still matters as evidence of capacity/i);
  assert.ok(summary.followUpQuestion && summary.followUpQuestion.length > 0);
  assertConciseReflection(summary.reflection);
  assertConciseQuestion(summary.followUpQuestion);
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
  assert.ok(response.nextQuestion);
  assertConciseReflection(response.reflection);
  assertConciseQuestion(response.nextQuestion);
  assert.equal(typeof response.canGoDeeper, "boolean");
  assert.doesNotMatch(
    response.reflection.toLowerCase(),
    /diagnos|disorder|condition/
  );
});

test("guided reflection answers product privacy questions without model inference", async () => {
  const response = await createGuidedReflectionGoDeeper({
    userId: "privacy-user",
    promptAnswers: [],
    currentText: "Are my journal messages safe and encrypted?",
  });

  assert.match(response.reflection, /HTTPS\/TLS/);
  assert.match(response.reflection, /not end-to-end encrypted/i);
  assert.equal(response.canGoDeeper, true);
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

  assert.match(response.reflection, /Another perspective/i);
  assertConciseReflection(response.reflection);
  assertConciseQuestion(response.nextQuestion);
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
  assertConciseReflection(summary.reflection);
  assertConciseQuestion(summary.followUpQuestion);
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

  assert.match(response.reflection, /not enough clear information/i);
  assertConciseReflection(response.reflection);
  assertConciseQuestion(response.nextQuestion);
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
  assert.deepEqual(analysis.topicsObserved, analysis.detectedTopics);
  assert.ok(analysis.detectedTopics.includes("discipline"));
  assert.ok(analysis.detectedTopics.includes("routines"));
  assert.ok(
    ["amazing", "good", "okay", "bad", "terrible"].includes(
      analysis.detectedMood
    )
  );
  assertValidBrainSessionMap(analysis.brainSessionMap);
  assert.equal(
    analysis.brainSessionMap.dominantCenterId,
    "planning_self_control"
  );
  assert.equal(
    analysis.brainSessionMap.dominantCenter.productName,
    "Planning & Self-Control"
  );
  assert.equal(
    analysis.brainSessionMap.dominantCenter.brainRegion,
    "Prefrontal Cortex"
  );
  assert.ok(
    analysis.brainSessionMap.secondaryCenterIds.includes(
      "relationships_perspective"
    )
  );
  assert.ok(
    analysis.brainSessionMap.dominantCenter.evidence.some((item) =>
      /disciplin|routine|carry/i.test(item)
    )
  );
  assert.doesNotMatch(
    analysis.analysis.toLowerCase(),
    /diagnos|disorder|therapy/
  );
  assert.ok(analysis.analysis.length <= 680);
  assert.ok(analysis.majorInsight.length <= 180);
  assert.ok(analysis.brainSessionMap.neuroscienceSummary.length <= 240);
  assert.ok(analysis.brainSessionMap.mostNoticedText.length <= 220);
  for (const center of analysis.brainSessionMap.centers) {
    assert.ok(center.shortInsight.length <= 180);
    assert.ok(center.evidence.length <= 3);
    assert.ok(center.evidence.every((item) => item.length <= 48));
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
  // Fully-verified lifetime premium so hasActivePremiumEntitlement is satisfied
  // (guided reflection is premium-gated by default).
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: true,
          premiumPlanKey: "lifetime",
          premiumSource: "revenuecat_verified",
        }),
      }),
    }),
  });
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit
  ) => {
    // Capture only the structured /responses call, not the embedding call.
    if (String(url).includes("/responses")) {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    }

    return new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          analysis:
            "This session suggests that focused movement helped create steadiness while the earlier deadline added pressure. The clearest pattern is that they protect calm progress rather than answering urgency with more urgency. Their writing puts the pull toward smaller tasks right after the deadline moved, not before it.",
          majorInsight:
            "The clearest signal is choosing calm, bounded progress when pressure rises.",
          observedTrends: ["Focus", "Pressure", "Calm progress"],
          triggersObserved: [
            {
              trigger: "the deadline moving",
              emotionalResponse: "shrinks the task",
              evidenceQuote: "",
              confidence: 0.7,
            },
          ],
          patternAssessment: [
            {
              label: "protects calm progress under pressure",
              basis: "Named twice in this session.",
            },
          ],
          detectedTopics: ["focus", "stress", "calm"],
          detectedMood: "good",
          brainSessionMap: fallback.brainSessionMap,
          hasEnoughSignal: true,
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
  assert.match(JSON.stringify(capturedRequestBody.input), /roughly 55%/i);
  assert.match(JSON.stringify(capturedRequestBody.input), /do not invent/i);
  // The session-analysis prompt used to mandate hedging outright, which
  // overrode the shared persona because it is appended after it. Pin both
  // halves: the mandate is gone, and the replacement is present.
  assert.doesNotMatch(
    JSON.stringify(capturedRequestBody.input),
    /Use hedged, behaviour-focused language/i
  );
  assert.match(
    JSON.stringify(capturedRequestBody.input),
    /Write behaviour-focused findings as statements, not as suggestions/i
  );
  // Third person is a report constraint, not a hedge, and must survive.
  assert.match(
    JSON.stringify(capturedRequestBody.input),
    /Never use 'you' or 'your' in any field/i
  );
  assert.equal(analysis.hasEnoughSignal, true);
  assert.match(analysis.analysis, /focused movement|steadiness/i);
  assert.deepEqual(analysis.detectedTopics, ["focus", "stress", "calm"]);
  assert.equal(analysis.detectedMood, "good");
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
  assert.match(analysis.analysis, /enough clear information/i);
  assert.match(analysis.majorInsight, /not enough clear detail/i);
  assert.deepEqual(analysis.observedTrends, [
    "More detail needed",
    "Reflection started",
    "Tomorrow",
  ]);
  assert.deepEqual(analysis.detectedTopics, []);
  assert.equal(analysis.detectedMood, "okay");
  assertValidBrainSessionMap(analysis.brainSessionMap);
  assert.equal(
    analysis.brainSessionMap.dominantCenterId,
    "self_reflection_identity"
  );
  assert.equal(analysis.brainSessionMap.centers[0]?.score, 0.55);
  assert.equal(
    analysis.brainSessionMap.mindMapSeedText,
    "This first reflection has added its first signal to the Mind Map."
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
  assert.match(analysis.analysis, /enough clear information/i);
  assertValidBrainSessionMap(analysis.brainSessionMap);
  assert.equal(
    analysis.brainSessionMap.dominantCenterId,
    "self_reflection_identity"
  );
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
    suggestions.goals.map((goal) => goal.description).join(" "),
    /five-minute|before noon|when pressure rises|after dinner/i
  );
  for (const goal of suggestions.goals) {
    assert.ok(goal.title.length <= 30);
    assert.ok(goal.description.length <= 96);
  }
  assert.doesNotMatch(
    suggestions.goals
      .map((goal) => `${goal.title} ${goal.description}`)
      .join(" ")
      .toLowerCase(),
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
  // With no real signal, a reflection goal about nothing is busywork: the
  // baseline "move your body" advice leads instead.
  assert.match(firstGoal.title, /walk|steps|train|stretch/i);
});

const buildSummaryInput = (userId: string) => ({
  userId,
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
  onboardingContext: { reflectionTone: ["practical"] },
});

test("the Free development flow keeps guided reflection premium-gated", async () => {
  process.env.NODE_ENV = "development";
  process.env.DEV_PREMIUM_ACCESS_OVERRIDE = "free";
  process.env.OPENAI_API_KEY = "test-key";

  // Configured API key + opted-in, but NOT premium → must fall back, no call.
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: false,
        }),
      }),
    }),
  });

  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const summary = await createFirstReflectionSummary(
    buildSummaryInput("free-user")
  );

  assert.equal(fetchCalled, false);
  assert.ok(summary.reflection.length > 0);
  assert.ok(summary.followUpQuestion.length > 0);
});

test("the Pro development flow lets a stored free user reach guided reflection AI", async () => {
  process.env.NODE_ENV = "development";
  process.env.DEV_PREMIUM_ACCESS_OVERRIDE = "pro";
  process.env.OPENAI_API_KEY = "test-key";

  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: false,
        }),
      }),
    }),
  });

  let responsesCalled = false;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const href = String(url);
    if (href.includes("/responses")) {
      responsesCalled = true;
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            reflection:
              "There is a clear wish to protect calm progress here, and the earlier deadline made that harder without erasing the steadiness you built with that walk. Keeping tomorrow's task small sounds like a way to stay in that steadier gear. Try naming one boundary that could protect it when urgency rises.",
            followUpQuestion:
              "When the deadline moved, what did the pressure feel like in your body?",
            takeaway: "Protect one small, calm task tomorrow.",
            sessionSignals: {
              triggers: [],
              activeTrigger: "",
              triggerStage: "surface",
            },
          }),
        }),
        { status: 200 }
      );
    }
    // Embedding call (or anything else): return a benign empty payload.
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  }) as typeof fetch;

  const summary = await createFirstReflectionSummary(
    buildSummaryInput("bypass-user")
  );

  assert.equal(responsesCalled, true);
  assert.match(summary.followUpQuestion, /deadline|pressure|body/i);
});

const stubPremiumUserWithModelResponse = (
  payload: Record<string, unknown>,
  onRequest?: (body: Record<string, unknown>) => void
) => {
  process.env.OPENAI_API_KEY = "test-key";
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: true,
          premiumPlanKey: "lifetime",
          premiumSource: "revenuecat_verified",
        }),
      }),
    }),
  });
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit
  ) => {
    if (String(url).includes("/responses")) {
      onRequest?.(JSON.parse(String(init?.body)) as Record<string, unknown>);

      return new Response(
        JSON.stringify({ output_text: JSON.stringify(payload) }),
        { status: 200 }
      );
    }

    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  }) as typeof fetch;
};

const meaningfulSessionInput = {
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
} satisfies Parameters<typeof createGuidedReflectionSessionAnalysis>[0];

test("createGuidedReflectionSessionAnalysis asks the model for hasEnoughSignal and at least one topic", async () => {
  let requestBody: Record<string, unknown> | null = null;
  const fallback = await createGuidedReflectionSessionAnalysis(
    meaningfulSessionInput
  );

  stubPremiumUserWithModelResponse(
    {
      analysis:
        "This reflection suggests that focused movement helped create steadiness while the earlier deadline added pressure. The clearest pattern is a wish to protect calm progress instead of answering urgency with more urgency.",
      majorInsight:
        "The clearest signal is choosing calm, bounded progress when pressure rises.",
      observedTrends: ["Focus", "Pressure", "Calm progress"],
      triggersObserved: [],
      patternAssessment: [],
      detectedTopics: ["focus", "stress"],
      detectedMood: "good",
      brainSessionMap: fallback.brainSessionMap,
      hasEnoughSignal: true,
    },
    body => {
      requestBody = body;
    }
  );

  const analysis = await createGuidedReflectionSessionAnalysis(
    meaningfulSessionInput
  );
  const body = requestBody as Record<string, unknown> | null;
  const schema = (
    body?.text as { format?: { schema?: Record<string, unknown> } } | undefined
  )?.format?.schema;

  // `strict: true` means every declared property has to be required, so the
  // flag has to appear in both places or the whole call is rejected.
  assert.ok(
    (schema?.required as string[]).includes("hasEnoughSignal"),
    "hasEnoughSignal must be a required schema property"
  );
  assert.match(
    JSON.stringify(body?.input),
    /at least one detectedTopic/i,
    "the prompt must demand a topic whenever there is signal"
  );
  assert.equal(analysis.hasEnoughSignal, true);
  assert.equal(analysis.isFallback, false);
  assert.deepEqual(analysis.detectedTopics, ["focus", "stress"]);
});

test("createGuidedReflectionSessionAnalysis falls back to heuristic topics when the model returns none", async () => {
  const fallback = await createGuidedReflectionSessionAnalysis(
    meaningfulSessionInput
  );

  stubPremiumUserWithModelResponse({
    analysis:
      "This reflection suggests that focused movement helped create steadiness while the earlier deadline added pressure. The clearest pattern is a wish to protect calm progress instead of answering urgency with more urgency.",
    majorInsight:
      "The clearest signal is choosing calm, bounded progress when pressure rises.",
    observedTrends: ["Focus", "Pressure", "Calm progress"],
    triggersObserved: [],
    patternAssessment: [],
    detectedTopics: [],
    detectedMood: "good",
    brainSessionMap: fallback.brainSessionMap,
    hasEnoughSignal: true,
  });

  const analysis = await createGuidedReflectionSessionAnalysis(
    meaningfulSessionInput
  );

  // One tag is the point: an empty Topics Detected card reads as a bug.
  assert.ok(
    analysis.detectedTopics.length >= 1,
    "a session with signal must carry at least one topic"
  );
  assert.deepEqual(analysis.topicsObserved, analysis.detectedTopics);
});

test("createGuidedReflectionSessionAnalysis replaces the copy when the model reports no signal", async () => {
  const fallback = await createGuidedReflectionSessionAnalysis(
    meaningfulSessionInput
  );

  stubPremiumUserWithModelResponse({
    analysis:
      "There is very little to work from here, so any pattern would be invented rather than observed from what was actually written down today.",
    majorInsight: "There is not enough here to name a reliable pattern.",
    observedTrends: ["Unclear", "Sparse"],
    triggersObserved: [],
    patternAssessment: [],
    detectedTopics: [],
    detectedMood: "okay",
    brainSessionMap: fallback.brainSessionMap,
    hasEnoughSignal: false,
  });

  const analysis = await createGuidedReflectionSessionAnalysis(
    meaningfulSessionInput
  );

  assert.equal(analysis.hasEnoughSignal, false);
  assert.match(analysis.analysis, /enough clear information/i);
  assert.match(analysis.majorInsight, /not enough clear detail/i);
  // The chosen presentation keeps the other cards, so the map still comes from
  // the model rather than being blanked out.
  assert.equal(analysis.brainSessionMap.dominantCenterId,
    fallback.brainSessionMap.dominantCenterId);
});

test("the open-ended fallback describes the entry instead of guided-flow boilerplate", async () => {
  const analysis = await createGuidedReflectionSessionAnalysis({
    userId: "free-user",
    promptAnswers: [
      {
        questionId: "open_ended_entry",
        question: "What felt most important today?",
        answer:
          "I kept putting off the message to my sister even though I thought about it all afternoon. By evening I felt guilty and tired, and I still had not written anything.",
      },
    ],
  });

  assert.equal(analysis.isFallback, true);
  // The guided question ids never resolve for an open-ended entry, which used
  // to leave the analysis as pure boilerplate with no trace of the writing.
  assert.doesNotMatch(analysis.analysis, /one harder moment/i);
  assert.match(analysis.analysis, /sister|putting off|guilty/i);
});

test("guided reflection merges the stored profile with the client onboarding context", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let requestBody: Record<string, unknown> | null = null;

  // Stored profile says gentle/student; the request carries the answers the
  // user just gave in the V2 flow, which are not persisted yet.
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: true,
          premiumPlanKey: "lifetime",
          premiumSource: "revenuecat_verified",
          name: "Avery Chen",
          onboardingPayload: {
            ageRange: "35_44",
            primaryContext: "student",
            reflectionTone: ["gentle"],
            supportFocusAreas: ["loneliness"],
            personalGoals: ["growth"],
          },
        }),
      }),
    }),
  });
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("/responses")) {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    }

    return new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          reflection:
            "Shipping the deploy you had been dreading all week is real evidence that you can carry something hard to the end. The part worth watching is the cost: midnight again, dinner skipped, and a body quietly paying for the win. Stopping at a reasonable hour tomorrow is the experiment, not the reward you get once everything else is finally finished.",
          followUpQuestion:
            "What would finishing at a reasonable hour actually cost you tomorrow?",
          takeaway: "Protect one boundary before the week sets its own pace.",
          sessionSignals: {
            triggers: [],
            activeTrigger: "",
            triggerStage: "none",
          },
        }),
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  await createFirstReflectionSummary({
    userId: "merge-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "What was one good or exciting thing that happened today?",
        answer: "We shipped the deploy I had been dreading all week.",
      },
      {
        questionId: "hurdle",
        question: "What was one hurdle or stressful moment you faced today?",
        answer: "I worked until midnight again and skipped dinner entirely.",
      },
      {
        questionId: "carry_tomorrow",
        question: "What would you like to carry into tomorrow?",
        answer: "I want to stop at a reasonable hour tomorrow.",
      },
    ],
    onboardingContext: {
      primaryContext: "founder_builder",
      reflectionTone: ["direct"],
      supportFocusAreas: ["overthinking", "focus"],
    },
  });

  const captured = requestBody as Record<string, unknown> | null;
  assert.ok(captured);

  const messages = captured.input as { role: string; content: string }[];
  const systemMessage = messages.find((message) => message.role === "system");
  const userProfile = JSON.parse(
    messages.find((message) => message.role === "user")?.content || "{}"
  ).userProfile as Record<string, unknown>;

  // Client answers win where they exist...
  assert.equal(userProfile.lifeContext, "Founder / building something");
  assert.equal(userProfile.reflectionTone, "Direct");
  assert.deepEqual(userProfile.focusAreas, ["Overthinking", "Focus"]);
  // ...and the stored profile fills everything the request did not carry.
  assert.equal(userProfile.ageRange, "35-44");
  assert.equal(userProfile.preferredName, "Avery");
  assert.deepEqual(userProfile.journalingGoals, ["Personal growth"]);

  // The tone steer follows the merged tone, not the stored one.
  assert.match(String(systemMessage?.content), /plain-spoken/);
  assert.doesNotMatch(String(systemMessage?.content), /soften confrontation/);
  assert.match(String(systemMessage?.content), /not a diagnosis/);

  // Guided reflection inherits the shared direct persona, not just Jade.
  assert.match(String(systemMessage?.content), /Answer first/i);
  assert.match(String(systemMessage?.content), /Avoid hedging vocabulary/i);
  assert.match(
    String(systemMessage?.content),
    /never invent details, events, or failings the user did not write/i
  );
});

test("guided reflection sends no profile when the user has no onboarding answers", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let requestBody: Record<string, unknown> | null = null;

  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: true,
          premiumPlanKey: "lifetime",
          premiumSource: "revenuecat_verified",
          name: "Sam",
        }),
      }),
    }),
  });
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("/responses")) {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    }

    return new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          reflection:
            "Shipping the deploy you had been dreading all week is worth naming, and so is what it took: another midnight, dinner skipped, a day spent entirely inside the work. The pull to stop at a reasonable hour tomorrow is already there. Notice what makes staying feel necessary, because that is usually the part that decides the week.",
          followUpQuestion:
            "What made stopping earlier feel impossible for you today?",
          takeaway: "Notice what the late night actually bought you.",
        }),
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  await createFirstReflectionSummary({
    userId: "bare-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "What was one good or exciting thing that happened today?",
        answer: "We shipped the deploy I had been dreading all week.",
      },
      {
        questionId: "hurdle",
        question: "What was one hurdle or stressful moment you faced today?",
        answer: "I worked until midnight again and skipped dinner entirely.",
      },
      {
        questionId: "carry_tomorrow",
        question: "What would you like to carry into tomorrow?",
        answer: "I want to stop at a reasonable hour tomorrow.",
      },
    ],
  });

  const captured = requestBody as Record<string, unknown> | null;
  assert.ok(captured);

  const messages = captured.input as { role: string; content: string }[];
  const userMessage = messages.find((message) => message.role === "user");
  assert.equal(JSON.parse(userMessage?.content || "{}").userProfile, null);
  // No profile means no guardrail either — there is nothing to guard.
  const systemMessage = messages.find((message) => message.role === "system");
  assert.doesNotMatch(String(systemMessage?.content), /not a diagnosis/);
});

// --- Trigger-driven guided reflection -------------------------------------

const buildGoDeeperInput = (overrides: Record<string, unknown> = {}) => ({
  userId: "free-user",
  promptAnswers: [
    {
      questionId: "good_exciting",
      question: "What was one good or exciting thing that happened today?",
      answer: "I finished the deck before lunch.",
    },
    {
      questionId: "hurdle",
      question: "What was one hurdle or stressful moment you faced today?",
      answer: "My manager messaged me about it and I went quiet.",
    },
    {
      questionId: "carry_tomorrow",
      question: "What would you like to carry into tomorrow?",
      answer: "I want to answer instead of going silent.",
    },
  ],
  currentText: "I went quiet for the rest of the afternoon.",
  ...overrides,
});

const CARRIED_TRIGGER = {
  trigger: "my manager messaging me",
  emotionalResponse: "goes quiet",
  evidenceQuote: "I went quiet for the rest of the afternoon.",
  confidence: 0.7,
  sessionOccurrences: 1,
};

test("every session analysis string is written in the third person", async () => {
  // The whole point of the report voice: one "your" undoes it everywhere.
  const analysis = await createGuidedReflectionSessionAnalysis(
    meaningfulSessionInput
  );

  const fields = [
    analysis.analysis,
    analysis.majorInsight,
    analysis.brainSessionMap.neuroscienceSummary,
    analysis.brainSessionMap.mostNoticedText,
    analysis.brainSessionMap.mindMapSeedText,
    ...analysis.brainSessionMap.centers.map(center => center.shortInsight),
  ];

  fields.forEach(field => {
    assert.ok(isThirdPersonVoice(field), `second person leaked: "${field}"`);
  });
});

test("low-signal and safety analyses are third person too", async () => {
  const lowSignal = await createGuidedReflectionSessionAnalysis({
    userId: "free-user",
    promptAnswers: [
      { questionId: "good_exciting", question: "?", answer: "asdf qwer" },
      { questionId: "hurdle", question: "?", answer: "lksdjf zzzzz" },
      { questionId: "carry_tomorrow", question: "?", answer: "qwer asdf" },
    ],
  });

  assert.ok(isThirdPersonVoice(lowSignal.analysis));
  assert.ok(isThirdPersonVoice(lowSignal.majorInsight));
  // Nothing to work from means nothing is reported and nothing reaches the
  // graph — an invented trigger would start accumulating occurrences.
  assert.deepEqual(lowSignal.triggersObserved, []);
  assert.deepEqual(lowSignal.patternAssessment, []);
});

test("a safety session reports no triggers and never mines the graph", async () => {
  const analysis = await createGuidedReflectionSessionAnalysis({
    userId: "free-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "?",
        answer: "Nothing good happened at all today.",
      },
      {
        questionId: "hurdle",
        question: "?",
        answer: "I keep thinking about killing myself and I cannot stop.",
      },
      {
        questionId: "carry_tomorrow",
        question: "?",
        answer: "I do not know if I want tomorrow.",
      },
    ],
  });

  assert.deepEqual(analysis.triggersObserved, []);
  assert.deepEqual(analysis.patternAssessment, []);
  assert.ok(isThirdPersonVoice(analysis.analysis));
});

test("go-deeper carries trigger state through the deterministic fallback", async () => {
  // requestStructuredOpenAi returns null on *any* failure, and on a bad day
  // that is every turn. Losing the carried thread there would abandon the
  // trigger mid-test — the exact failure this feature exists to fix.
  const response = await createGuidedReflectionGoDeeper(
    buildGoDeeperInput({ previousSignals: [CARRIED_TRIGGER] })
  );

  assert.equal(response.sessionSignals.triggers.length, 1);
  assert.equal(
    response.sessionSignals.triggers[0]?.trigger,
    "my manager messaging me"
  );
  assert.equal(response.sessionSignals.activeTrigger, "my manager messaging me");
});

test("the fallback question climbs the ladder instead of changing topic", async () => {
  const firstRung = await createGuidedReflectionGoDeeper(
    buildGoDeeperInput({ previousSignals: [CARRIED_TRIGGER] })
  );
  assert.match(firstRung.nextQuestion, /right before/i);

  const secondRung = await createGuidedReflectionGoDeeper(
    buildGoDeeperInput({
      previousSignals: [{ ...CARRIED_TRIGGER, sessionOccurrences: 2 }],
    })
  );
  assert.match(secondRung.nextQuestion, /what does that reaction do/i);
});

test("a session with no carried trigger keeps the generic fallback question", async () => {
  const response = await createGuidedReflectionGoDeeper(buildGoDeeperInput());

  assert.deepEqual(response.sessionSignals.triggers, []);
  assert.equal(response.sessionSignals.triggerStage, "none");
  assert.match(response.nextQuestion, /small change|clearest next action/i);
});

test("a client-supplied clinical trigger now survives the round trip", async () => {
  // previousSignals arrives from the client and is untrusted. The clinical-term
  // filter that used to sit here was removed on purpose: once the server itself
  // emits clinical wording, filtering the echo path would strip exactly the new
  // labels and break carried-trigger continuity.
  //
  // The residual exposure is bounded — a tampered client can only seed labels
  // into its OWN user's graph, because ownership is enforced upstream. There is
  // no cross-user write. If that ever needs closing, the fix is to validate
  // echoed signals against server-persisted ones rather than to filter their
  // wording.
  const response = await createGuidedReflectionGoDeeper(
    buildGoDeeperInput({
      previousSignals: [
        {
          trigger: "a deadline",
          emotionalResponse: "depression",
          evidenceQuote: "",
          confidence: 0.9,
          sessionOccurrences: 4,
        },
      ],
    })
  );

  assert.equal(response.sessionSignals.triggers.length, 1);
  assert.equal(
    response.sessionSignals.triggers[0]?.emotionalResponse,
    "depression"
  );
});

test("a fabricated evidence quote is dropped while the trigger survives", async () => {
  const response = await createGuidedReflectionGoDeeper(
    buildGoDeeperInput({
      previousSignals: [
        {
          ...CARRIED_TRIGGER,
          evidenceQuote: "I have always shut down when anyone criticises me.",
        },
      ],
    })
  );

  assert.equal(response.sessionSignals.triggers.length, 1);
  assert.equal(
    response.sessionSignals.triggers[0]?.evidenceQuote,
    "",
    "a quote the user never wrote must not be shown back as their own words"
  );
});

test("the go-deeper prompt sends carried triggers and the rung machine", async () => {
  let requestBody: Record<string, unknown> | null = null;
  stubPremiumUserWithModelResponse(
    {
      reflection:
        "Going quiet after that message is doing something for you, even if it does not feel like a choice in the moment. It buys a little distance while you work out what the message actually meant. That distance has a cost though, and naming it may make the next reply easier to send.",
      nextQuestion: "What does going quiet protect you from right then?",
      canGoDeeper: true,
      sessionSignals: {
        triggers: [
          {
            trigger: "my manager messaging me",
            emotionalResponse: "goes quiet",
            evidenceQuote: "I went quiet for the rest of the afternoon.",
            confidence: 0.8,
          },
        ],
        activeTrigger: "my manager messaging me",
        triggerStage: "function",
      },
    },
    body => {
      requestBody = body;
    }
  );

  const response = await createGuidedReflectionGoDeeper(
    buildGoDeeperInput({
      userId: "premium-user",
      previousSignals: [CARRIED_TRIGGER],
    })
  );

  const serialized = JSON.stringify(
    (requestBody as Record<string, unknown> | null)?.input
  );
  assert.match(serialized, /carriedTriggers/);
  assert.match(serialized, /turnsSupported/);
  assert.match(serialized, /Never skip a rung/i);
  assert.match(serialized, /triggerStage/);

  // Two sightings of one trigger, not two triggers.
  assert.equal(response.sessionSignals.triggers.length, 1);
  assert.equal(response.sessionSignals.triggers[0]?.sessionOccurrences, 2);
  assert.equal(response.sessionSignals.triggerStage, "function");
});

test("the session analysis prompt demands third person and forbids advice", async () => {
  let requestBody: Record<string, unknown> | null = null;
  const fallback = await createGuidedReflectionSessionAnalysis(
    meaningfulSessionInput
  );

  stubPremiumUserWithModelResponse(
    {
      analysis: fallback.analysis,
      majorInsight: "They shrink the task whenever a deadline moves.",
      observedTrends: ["Deadline pressure", "Task shrinking"],
      triggersObserved: [],
      patternAssessment: [],
      detectedTopics: ["stress"],
      detectedMood: "okay",
      brainSessionMap: fallback.brainSessionMap,
      hasEnoughSignal: true,
    },
    body => {
      requestBody = body;
    }
  );

  await createGuidedReflectionSessionAnalysis({
    ...meaningfulSessionInput,
    userId: "premium-user",
  });

  const body = requestBody as Record<string, unknown> | null;
  const serialized = JSON.stringify(body?.input);
  assert.match(serialized, /Never use 'you' or 'your'/);
  assert.match(serialized, /Do not comfort, encourage, reassure, advise/);
  assert.match(serialized, /knownPatterns/);

  const schema = (
    body?.text as { format?: { schema?: Record<string, unknown> } } | undefined
  )?.format?.schema;
  const required = (schema?.required as string[]) || [];
  assert.ok(required.includes("triggersObserved"));
  assert.ok(required.includes("patternAssessment"));
});

test("a second-person analysis is replaced rather than shipped", async () => {
  const fallback = await createGuidedReflectionSessionAnalysis(
    meaningfulSessionInput
  );

  stubPremiumUserWithModelResponse({
    analysis:
      "Your session kept returning to the deadline, and your mood dropped right after it moved. You go quiet when the pressure rises, which is worth watching over the next week or so.",
    majorInsight: "You shrink the task whenever a deadline moves.",
    observedTrends: ["Deadline pressure", "Task shrinking"],
    triggersObserved: [],
    patternAssessment: [],
    detectedTopics: ["stress"],
    detectedMood: "okay",
    brainSessionMap: fallback.brainSessionMap,
    hasEnoughSignal: true,
  });

  const analysis = await createGuidedReflectionSessionAnalysis({
    ...meaningfulSessionInput,
    userId: "premium-user",
  });

  assert.ok(isThirdPersonVoice(analysis.analysis));
  assert.ok(isThirdPersonVoice(analysis.majorInsight));
  assert.equal(analysis.analysis, fallback.analysis);
  // The rest of the response survives: rejecting the whole payload would cost
  // the brain map and the topics too.
  assert.deepEqual(analysis.detectedTopics, ["stress"]);
  assert.equal(analysis.detectedMood, "okay");
});

test("the analysis grades a first-sighting trigger as emerging, not confirmed", async () => {
  const fallback = await createGuidedReflectionSessionAnalysis(
    meaningfulSessionInput
  );

  stubPremiumUserWithModelResponse({
    analysis: fallback.analysis,
    majorInsight: "They go quiet right after a message from their manager.",
    observedTrends: ["Manager messages", "Going quiet"],
    triggersObserved: [
      {
        trigger: "a message from their manager",
        emotionalResponse: "goes quiet",
        evidenceQuote: "",
        confidence: 0.8,
      },
    ],
    patternAssessment: [
      { label: "goes quiet after a manager message", basis: "Named twice." },
    ],
    detectedTopics: ["stress"],
    detectedMood: "okay",
    brainSessionMap: fallback.brainSessionMap,
    hasEnoughSignal: true,
  });

  const analysis = await createGuidedReflectionSessionAnalysis({
    ...meaningfulSessionInput,
    userId: "premium-user",
  });

  assert.equal(analysis.triggersObserved.length, 1);
  // No graph history, so this is sighting one. Reporting it as established
  // would be the one error this feature cannot afford.
  assert.equal(analysis.triggersObserved[0]?.status, "emerging");
  assert.equal(analysis.triggersObserved[0]?.occurrences, 1);
  assert.equal(analysis.patternAssessment[0]?.status, "emerging");
});

// --- App-authored text is never the user's -------------------------------

const JADE_LONG_REFLECTION =
  "Protecting your morning seems tied to the focused hour you keep reaching for, and it sounds less like time management than guarding something that genuinely matters to you right now. Keeping tomorrow's first task small enough to finish is one way to hold that line without turning it into another obligation you have to meet.";

test("a thin session is thin however much Journal.IO wrote back", async () => {
  // The bug this guards: looksLikeLowSignalText needs 8 informative words, and
  // Jade's own reflection clears that bar by itself — so four user words used
  // to earn a full, confident analysis built on nothing the person said.
  const analysis = await createGuidedReflectionSessionAnalysis({
    userId: "free-user",
    promptAnswers: [
      { questionId: "good_exciting", question: "?", answer: "good day" },
      { questionId: "hurdle", question: "?", answer: "traffic" },
      { questionId: "carry_tomorrow", question: "?", answer: "sleep" },
    ],
    aiSummary: JADE_LONG_REFLECTION,
    threadMessages: [
      {
        role: "assistant",
        kind: "assistant_reflection",
        text: JADE_LONG_REFLECTION,
      },
    ],
  });

  assert.equal(analysis.hasEnoughSignal, false);
  assert.deepEqual(analysis.triggersObserved, []);
  assert.deepEqual(analysis.patternAssessment, []);
  assert.doesNotMatch(analysis.analysis, /protecting your morning/i);
});

test("the same session with real user writing is not low signal", async () => {
  const analysis = await createGuidedReflectionSessionAnalysis({
    userId: "free-user",
    promptAnswers: [
      {
        questionId: "good_exciting",
        question: "?",
        answer: "I finished the deck before lunch and felt genuinely relieved.",
      },
      {
        questionId: "hurdle",
        question: "?",
        answer: "My manager messaged about it and I went quiet all afternoon.",
      },
      {
        questionId: "carry_tomorrow",
        question: "?",
        answer: "I want to answer him instead of going silent again.",
      },
    ],
  });

  assert.equal(analysis.hasEnoughSignal, true);
});

test("the analysis prompt separates what the app wrote from what they wrote", async () => {
  let requestBody: Record<string, unknown> | null = null;
  const fallback = await createGuidedReflectionSessionAnalysis(
    meaningfulSessionInput
  );

  stubPremiumUserWithModelResponse(
    {
      analysis: fallback.analysis,
      majorInsight: "They shrink the task whenever a deadline moves.",
      observedTrends: ["Deadline pressure", "Task shrinking"],
      triggersObserved: [],
      patternAssessment: [],
      detectedTopics: ["stress"],
      detectedMood: "okay",
      brainSessionMap: fallback.brainSessionMap,
      hasEnoughSignal: true,
    },
    body => {
      requestBody = body;
    }
  );

  await createGuidedReflectionSessionAnalysis({
    ...meaningfulSessionInput,
    userId: "premium-user",
    aiSummary: JADE_LONG_REFLECTION,
    threadMessages: [
      {
        role: "assistant",
        kind: "assistant_reflection",
        text: JADE_LONG_REFLECTION,
        promptQuestion: "What gets in the way of that first hour?",
      },
    ],
  });

  const body = requestBody as Record<string, unknown> | null;
  const payload = JSON.parse(
    String((body?.input as { content?: string }[])?.[1]?.content || "{}")
  ) as {
    userAuthored: { fullText: string; wordCount: number; answers: unknown[] };
    appAuthoredContext: {
      questionsAsked: string[];
      assistantReflections: string[];
    };
  };

  // Jade's words are present as context...
  assert.ok(
    payload.appAuthoredContext.assistantReflections.some(item =>
      item.includes("Protecting your morning")
    )
  );
  assert.ok(payload.appAuthoredContext.questionsAsked.length > 0);

  // ...and absent from everything marked as the person's.
  assert.doesNotMatch(payload.userAuthored.fullText, /Protecting your morning/);
  // `questionId` is a key, not the question text — assert on the shape.
  assert.deepEqual(
    Object.keys(payload.userAuthored.answers[0] as Record<string, unknown>).sort(),
    ["answer", "questionId"],
    "the app's question text must not ride along inside a user answer"
  );

  const serialized = JSON.stringify(body?.input);
  assert.match(serialized, /Never quote appAuthoredContext/);
  assert.match(serialized, /was written by the app/);
});

test("an assistant sentence can never become evidence or a trigger quote", async () => {
  const fallback = await createGuidedReflectionSessionAnalysis(
    meaningfulSessionInput
  );

  stubPremiumUserWithModelResponse({
    analysis: fallback.analysis,
    majorInsight: "They shrink the task whenever a deadline moves.",
    observedTrends: ["Deadline pressure", "Task shrinking"],
    triggersObserved: [
      {
        trigger: "a moved deadline",
        emotionalResponse: "shrinks the task",
        // Jade wrote this, not the user. It must not survive.
        evidenceQuote: "Protecting your morning seems tied to the focused hour",
        confidence: 0.8,
      },
    ],
    patternAssessment: [],
    detectedTopics: ["stress"],
    detectedMood: "okay",
    brainSessionMap: fallback.brainSessionMap,
    hasEnoughSignal: true,
  });

  const analysis = await createGuidedReflectionSessionAnalysis({
    ...meaningfulSessionInput,
    userId: "premium-user",
    aiSummary: JADE_LONG_REFLECTION,
  });

  assert.equal(analysis.triggersObserved[0]?.evidenceQuote, "");
  // The trigger itself survives — only the unsupported attribution is dropped.
  assert.equal(analysis.triggersObserved[0]?.trigger, "a moved deadline");
});

// --- One-time onboarding AI allowance -------------------------------------
//
// The first guided reflection runs before the trial is ever offered, so a plain
// premium check is false for every new account and the whole first session would
// be served from the deterministic templates. These cover the counted allowance
// that lets it reach the model exactly once per account.

/**
 * Stands in for the conditional findOneAndUpdate, including its atomicity: the
 * increment only lands when the filter matches, which is what stops two
 * concurrent go-deeper turns from both passing the cap.
 */
const stubOnboardingAllowance = (state: {
  onboardingCompleted: boolean;
  // Optional on purpose: accounts created before the field existed have no
  // value at all, and the filter has to keep matching them.
  onboardingAiCallsUsed?: number;
}) => {
  const claims: Array<{ cap: number; granted: boolean }> = [];

  userTarget.findOneAndUpdate = (filter) => {
    const cap = (
      filter.onboardingAiCallsUsed as { $not: { $gte: number } }
    ).$not.$gte;
    // Mirrors { $not: { $gte: cap } }, which matches a missing field where a
    // plain { $lt: cap } would not.
    const granted =
      filter.onboardingCompleted === false &&
      !state.onboardingCompleted &&
      !((state.onboardingAiCallsUsed as number) >= cap);

    if (granted) {
      // $inc initialises a missing field to 1.
      state.onboardingAiCallsUsed = (state.onboardingAiCallsUsed ?? 0) + 1;
    }
    claims.push({ cap, granted });

    return {
      lean: () => ({
        exec: async () => (granted ? { _id: "onboarding-user" } : null),
      }),
    };
  };

  return claims;
};

const GO_DEEPER_INPUT = {
  userId: "onboarding-user",
  promptAnswers: [
    {
      questionId: "good_exciting",
      question: "What was one good or exciting thing that happened today?",
      answer: "I finished the report I had been avoiding for a week",
    },
    {
      questionId: "hurdle",
      question: "What was one hurdle or stressful moment you faced today?",
      answer: "My manager rescheduled our one to one again and I went quiet",
    },
    {
      questionId: "carry_tomorrow",
      question: "What would you like to carry into tomorrow?",
      answer: "Saying the thing instead of swallowing it",
    },
  ],
  currentText: "I keep going silent whenever a meeting with him moves.",
  onboardingContext: { reflectionTone: ["practical"] },
} satisfies Parameters<typeof createGuidedReflectionGoDeeper>[0];

const MODEL_REFLECTION =
  "You went quiet the moment the meeting moved, and that is the second time " +
  "this week the same rescheduling has produced the same silence rather than " +
  "a reply. Finishing the report shows you can act when the path is clear; " +
  "the silence shows what happens when it is not. Tomorrow, send one sentence " +
  "asking for a new time before the day fills up.";

/**
 * Counts the structured /responses calls so a test can tell a real model turn
 * from template copy, rather than pattern-matching on wording.
 */
const stubGoDeeperModel = () => {
  const calls: string[] = [];

  globalThis.fetch = (async (url: string | URL | Request) => {
    if (String(url).includes("/responses")) {
      calls.push(String(url));
    }

    return new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          reflection: MODEL_REFLECTION,
          nextQuestion: "What did you want to say when the meeting moved?",
          canGoDeeper: true,
          sessionSignals: {
            triggers: [],
            activeTrigger: "the meeting being rescheduled",
            triggerStage: "test",
          },
        }),
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  return calls;
};

const stubNonPremiumUser = () => {
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({ isPremium: false }),
      }),
    }),
  });
};

test("the onboarding allowance lets a non-premium first reflection reach the model", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  stubNonPremiumUser();
  const state = { onboardingCompleted: false, onboardingAiCallsUsed: 0 };
  const claims = stubOnboardingAllowance(state);
  const calls = stubGoDeeperModel();

  const response = await createGuidedReflectionGoDeeper(GO_DEEPER_INPUT);

  assert.equal(calls.length, 1);
  assert.equal(response.reflection, MODEL_REFLECTION);
  // Spending exactly one call per allowed turn is what keeps the cap meaningful.
  assert.equal(state.onboardingAiCallsUsed, 1);
  assert.equal(claims.length, 1);
  assert.equal(claims[0]?.granted, true);
});

test("the onboarding allowance stops at its cap", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  stubNonPremiumUser();
  const state = {
    onboardingCompleted: false,
    onboardingAiCallsUsed: Number.MAX_SAFE_INTEGER,
  };
  stubOnboardingAllowance(state);
  const calls = stubGoDeeperModel();

  const response = await createGuidedReflectionGoDeeper(GO_DEEPER_INPUT);

  assert.equal(calls.length, 0);
  assert.notEqual(response.reflection, MODEL_REFLECTION);
  assert.ok(response.reflection.length > 0);
});

test("a finished onboarding falls back to the plain premium gate", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  stubNonPremiumUser();
  const state = { onboardingCompleted: true, onboardingAiCallsUsed: 0 };
  stubOnboardingAllowance(state);
  const calls = stubGoDeeperModel();

  const response = await createGuidedReflectionGoDeeper(GO_DEEPER_INPUT);

  assert.equal(calls.length, 0);
  assert.notEqual(response.reflection, MODEL_REFLECTION);
  // The allowance is one-time: replaying onboarding must not mint more calls.
  assert.equal(state.onboardingAiCallsUsed, 0);
});

test("a premium user never spends the onboarding allowance", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: true,
          premiumPlanKey: "lifetime",
          premiumSource: "revenuecat_verified",
        }),
      }),
    }),
  });
  const state = { onboardingCompleted: false, onboardingAiCallsUsed: 0 };
  const claims = stubOnboardingAllowance(state);
  const calls = stubGoDeeperModel();

  const response = await createGuidedReflectionGoDeeper(GO_DEEPER_INPUT);

  assert.equal(calls.length, 1);
  assert.equal(response.reflection, MODEL_REFLECTION);
  assert.equal(claims.length, 0);
  assert.equal(state.onboardingAiCallsUsed, 0);
});

test("a safety signal answers without the model or the allowance", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  stubNonPremiumUser();
  const state = { onboardingCompleted: false, onboardingAiCallsUsed: 0 };
  const claims = stubOnboardingAllowance(state);
  const calls = stubGoDeeperModel();

  const response = await createGuidedReflectionGoDeeper({
    ...GO_DEEPER_INPUT,
    currentText: "I want to kill myself tonight.",
  });

  assert.equal(calls.length, 0);
  assert.equal(claims.length, 0);
  assert.equal(state.onboardingAiCallsUsed, 0);
  assert.notEqual(response.reflection, MODEL_REFLECTION);
});

test("a database failure in the allowance degrades to the template", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  stubNonPremiumUser();
  userTarget.findOneAndUpdate = () => ({
    lean: () => ({
      exec: async () => {
        throw new Error("connection lost");
      },
    }),
  });
  const calls = stubGoDeeperModel();

  const response = await createGuidedReflectionGoDeeper(GO_DEEPER_INPUT);

  assert.equal(calls.length, 0);
  assert.ok(response.reflection.length > 0);
  assert.ok(response.nextQuestion.length > 0);
});

test("an account predating the counter still gets the onboarding allowance", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  stubNonPremiumUser();
  // No onboardingAiCallsUsed at all, as every account created before this
  // field shipped. A { $lt: cap } filter would silently skip these users and
  // leave them on template copy forever.
  const state: { onboardingCompleted: boolean; onboardingAiCallsUsed?: number } =
    { onboardingCompleted: false };
  stubOnboardingAllowance(state);
  const calls = stubGoDeeperModel();

  const response = await createGuidedReflectionGoDeeper(GO_DEEPER_INPUT);

  assert.equal(calls.length, 1);
  assert.equal(response.reflection, MODEL_REFLECTION);
  assert.equal(state.onboardingAiCallsUsed, 1);
});
