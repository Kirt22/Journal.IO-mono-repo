import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { userModel } from "../../schema/user.schema";
import { clearUserPersonalizationCache } from "../../helpers/userPersonalization.helpers";
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

const getWordCount = (value: string) =>
  value.trim().split(/\s+/).filter(Boolean).length;

const assertConciseReflection = (value: string) => {
  assert.ok(getWordCount(value) <= 70);
};

const assertConciseQuestion = (value: string) => {
  const wordCount = getWordCount(value);
  assert.ok(wordCount >= 6);
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
            "This reflection suggests that focused movement helped create steadiness while the earlier deadline added pressure. The clearest pattern is a wish to protect calm progress instead of responding to urgency with more urgency. Keeping tomorrow's task deliberately small may support that direction without making the day feel over-controlled.",
          majorInsight:
            "The clearest signal is choosing calm, bounded progress when pressure rises.",
          observedTrends: ["Focus", "Pressure", "Calm progress"],
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
  assert.match(analysis.analysis, /not enough clear information/i);
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

test("guided reflection is premium-gated: non-premium never calls the model", async () => {
  const originalBypass = process.env.GUIDED_REFLECTION_ALLOW_NON_PREMIUM;
  delete process.env.GUIDED_REFLECTION_ALLOW_NON_PREMIUM;
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

  if (typeof originalBypass === "string") {
    process.env.GUIDED_REFLECTION_ALLOW_NON_PREMIUM = originalBypass;
  } else {
    delete process.env.GUIDED_REFLECTION_ALLOW_NON_PREMIUM;
  }
});

test("GUIDED_REFLECTION_ALLOW_NON_PREMIUM bypass lets an opted-in non-premium user reach the model", async () => {
  const originalBypass = process.env.GUIDED_REFLECTION_ALLOW_NON_PREMIUM;
  process.env.GUIDED_REFLECTION_ALLOW_NON_PREMIUM = "true";
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

  if (typeof originalBypass === "string") {
    process.env.GUIDED_REFLECTION_ALLOW_NON_PREMIUM = originalBypass;
  } else {
    delete process.env.GUIDED_REFLECTION_ALLOW_NON_PREMIUM;
  }
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
    detectedTopics: [],
    detectedMood: "okay",
    brainSessionMap: fallback.brainSessionMap,
    hasEnoughSignal: false,
  });

  const analysis = await createGuidedReflectionSessionAnalysis(
    meaningfulSessionInput
  );

  assert.equal(analysis.hasEnoughSignal, false);
  assert.match(analysis.analysis, /not enough clear information/i);
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
