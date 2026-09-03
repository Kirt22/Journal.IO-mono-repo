#!/usr/bin/env node
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, rename, writeFile } from "node:fs/promises";
import "dotenv/config";
import {
  addLocalDays,
  assertAuthoredScenario,
  assertScratchCaptureEnvironment,
  authoredHashInput,
  dateForOffset,
  normalizeCapturedDates,
  sha256,
  toLocalDateKey,
} from "./demo-fixture-utils.mjs";

const SCENARIO_ID = process.argv[2]?.trim();
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCENARIO_DIR = path.resolve(
  SCRIPT_DIR,
  "../../frontend/src/demo/scenarios",
);
const TIME_ZONE = process.env.DEMO_CAPTURE_TIME_ZONE?.trim() || "UTC";
const MOODS = ["terrible", "bad", "okay", "good", "amazing"];
const GUIDED_ACTIONS = [
  "gentle_prompt",
  "go_deeper",
  "another_perspective",
  "small_next_step",
  "summarize",
];
const GUIDED_QUESTIONS = [
  {
    questionId: "good_exciting",
    question: "What was one good or exciting thing that happened today?",
  },
  {
    questionId: "hurdle",
    question: "What was one hurdle or stressful moment you faced today?",
  },
  {
    questionId: "carry_tomorrow",
    question: "What would you like to carry into tomorrow?",
  },
];

const composeGuidedContent = ({ answers, reflection }) =>
  [
    `One good or exciting thing from today:\n${answers[0]}`,
    `One hurdle or stressful moment:\n${answers[1]}`,
    `What I want to carry into tomorrow:\n${answers[2]}`,
    `Journal.IO reflection:\n${reflection.trim()}`,
  ].join("\n\n");

const appAuthoredSegments = reflection => [
  "One good or exciting thing from today:",
  "One hurdle or stressful moment:",
  "What I want to carry into tomorrow:",
  "Journal.IO reflection:",
  reflection.trim(),
];

const promptAnswersFor = entry =>
  GUIDED_QUESTIONS.map((question, index) => ({
    ...question,
    answer: entry.answers[index],
  }));

const serializeMoodCheckIn = document => ({
  _id: document._id.toString(),
  mood: document.mood,
  moodDateKey: document.moodDateKey,
  createdAt: document.createdAt.toISOString(),
  updatedAt: document.updatedAt.toISOString(),
});

const run = async () => {
  if (!SCENARIO_ID || !/^[a-z0-9-]+$/.test(SCENARIO_ID)) {
    throw new Error("Usage: yarn demo:capture <scenario-id>");
  }

  const fixturePath = path.join(SCENARIO_DIR, `${SCENARIO_ID}.json`);
  const scenario = JSON.parse(await readFile(fixturePath, "utf8"));
  assertAuthoredScenario(scenario);
  if (scenario.id !== SCENARIO_ID) {
    throw new Error("Scenario filename and id must match.");
  }

  const scratchUri = process.env.DEMO_CAPTURE_MONGO_URI?.trim() || "";
  const databaseName = assertScratchCaptureEnvironment({
    env: process.env,
    uri: scratchUri,
  });
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("Set OPENAI_API_KEY before capturing a scenario.");
  }

  process.env.TZ = TIME_ZONE;
  process.env.MONGO_URI = scratchUri;
  process.env.MONGO_STAGE = "local";
  process.env.NODE_ENV = "development";
  process.env.DEV_PREMIUM_ACCESS_OVERRIDE = "pro";

  const captureAnchor = new Date();
  const auditEvents = [];
  const sourceModels = new Map();
  let mongoose;

  try {
    const { init_mongoDB } = await import("../dist/config/mongo.db.config.js");
    const { userModel } = await import("../dist/schema/user.schema.js");
    const { journalModel } = await import("../dist/schema/journal.schema.js");
    const { moodCheckInModel } = await import("../dist/schema/mood.schema.js");
    const {
      registerOpenAiCallAuditObserver,
    } = await import("../dist/helpers/openai.helpers.js");
    const {
      createFirstReflectionSummary,
      createGuidedReflectionGoDeeper,
      createGuidedReflectionGoalSuggestions,
      createGuidedReflectionSessionAnalysis,
    } = await import(
      "../dist/services/guided-reflection/guided-reflection.service.js"
    );
    const {
      persistJournalSessionAnalysisSnapshot,
    } = await import("../dist/services/journal/journalMetadata.service.js");
    const {
      getJournalQuickAnalysis,
      getJournalSessionAnalysis,
      serializeJournal,
    } = await import("../dist/services/journal/journal.service.js");
    const {
      getEntryMindMap,
      persistEntryScore,
      runEntryAiScore,
    } = await import("../dist/services/mindmap/mindmap.service.js");
    const {
      getInsightsAiAnalysis,
      getInsightsMindMap,
      getInsightsMindMapRegionSeries,
      getInsightsOverview,
      markUserMindMapStale,
      rebuildInsightsCache,
    } = await import("../dist/services/insights/insights.service.js");
    const { sendJadeMessage } = await import(
      "../dist/services/ask-jade/askJade.service.js"
    );
    const { createGoal, createGoalSuggestions, getGoals } = await import(
      "../dist/services/goals/goals.service.js"
    );
    mongoose = (await import("mongoose")).default;

    registerOpenAiCallAuditObserver(event => {
      auditEvents.push(event);
      if (event.outcome === "success") {
        const models = sourceModels.get(event.feature) || new Set();
        models.add(event.model);
        sourceModels.set(event.feature, models);
      }
    });

    await init_mongoDB();
    await mongoose.connection.dropDatabase();

    const premiumActivatedAt = dateForOffset(captureAnchor, -29, "00:00");
    const user = await userModel.create({
      name: "Demo Journaler",
      email: `demo-capture+${SCENARIO_ID}@journalio.invalid`,
      emailVerified: true,
      authProviders: ["email"],
      journalingGoals: [],
      goals: [],
      profileSetupCompleted: true,
      onboardingCompleted: true,
      onboardingVersion: 2,
      onboardingCompletedAt: premiumActivatedAt,
      isPremium: true,
      premiumPlanKey: "lifetime",
      premiumActivatedAt,
      premiumSource: "revenuecat_verified",
    });
    const userId = user._id.toString();
    const capturedEntries = [];
    const journalByOffset = new Map();
    const quickAnalysisByJournalId = {};
    const sessionAnalysisByJournalId = {};
    const entryMindMapByJournalId = {};
    const moodCheckIns = [];
    let capturedGuidedFlow = null;

    for (const entry of scenario.entries) {
      const promptAnswers = promptAnswersFor(entry);
      const summary = await createFirstReflectionSummary({ userId, promptAnswers });
      const content = composeGuidedContent({
        answers: entry.answers,
        reflection: summary.reflection,
      });
      const authoredSegments = appAuthoredSegments(summary.reflection);
      const createdAt = dateForOffset(
        captureAnchor,
        entry.dayOffset,
        entry.timeOfDay,
      );

      const [journal] = await journalModel.create(
        [
          {
            userId: user._id,
            title: "Today's reflection",
            content,
            type: "guided",
            entryKind: "journal",
            aiPrompt: "Onboarding first guided reflection",
            appAuthoredSegments: authoredSegments,
            tags: entry.tags || [],
            detectedTopics: entry.detectedTopics || [],
            images: [],
            isFavorite: Boolean(entry.isFavorite),
            createdAt,
            updatedAt: createdAt,
          },
        ],
        { timestamps: false },
      );
      const journalId = journal._id.toString();
      journalByOffset.set(entry.dayOffset, journalId);

      await persistEntryScore({
        userId,
        journalId,
        entryType: "guided",
        content,
        aiPrompt: "Onboarding first guided reflection",
        appAuthoredSegments: authoredSegments,
        tags: entry.tags || [],
        isFavorite: Boolean(entry.isFavorite),
        entryCreatedAt: createdAt,
      });
      const upgraded = await runEntryAiScore({
        userId,
        journalId,
        content,
        aiPrompt: "Onboarding first guided reflection",
        entryType: "guided",
        appAuthoredSegments: authoredSegments,
        tags: entry.tags || [],
        awaitSecondaryUpdates: true,
      });
      if (!upgraded) {
        throw new Error(`Entry AI scoring failed for dayOffset ${entry.dayOffset}.`);
      }

      const sessionAnalysis = await createGuidedReflectionSessionAnalysis({
        userId,
        journalId,
        promptAnswers,
        aiSummary: summary.reflection,
      });
      if (sessionAnalysis.isFallback) {
        throw new Error(`Session analysis fell back for dayOffset ${entry.dayOffset}.`);
      }
      await persistJournalSessionAnalysisSnapshot({
        userId,
        journalId,
        analysis: sessionAnalysis,
        source: "guided",
      });

      if (entry.dayOffset === scenario.filmingEntryDayOffset) {
        const suggestions = {};
        for (const suggestionAction of GUIDED_ACTIONS) {
          suggestions[suggestionAction] = await createGuidedReflectionGoDeeper({
            userId,
            promptAnswers,
            aiSummary: summary.reflection,
            currentText: "",
            suggestionAction,
          });
        }
        const goalSuggestions = await createGuidedReflectionGoalSuggestions({
          userId,
          promptAnswers,
          aiSummary: summary.reflection,
          sessionAnalysis,
        });
        capturedGuidedFlow = {
          firstSummary: summary,
          suggestions,
          sessionAnalysis,
          goalSuggestions,
        };
      }

      const [moodCheckIn] = await moodCheckInModel.create(
        [
          {
            userId: user._id,
            mood: MOODS[entry.mood - 1],
            moodDateKey: toLocalDateKey(createdAt),
            moodDateKeyVersion: 1,
            createdAt,
            updatedAt: createdAt,
          },
        ],
        { timestamps: false },
      );
      moodCheckIns.push(serializeMoodCheckIn(moodCheckIn));
      capturedEntries.push(serializeJournal(journal));
      sessionAnalysisByJournalId[journalId] = await getJournalSessionAnalysis({
        userId,
        journalId,
      });
      quickAnalysisByJournalId[journalId] = await getJournalQuickAnalysis({
        userId,
        journalId,
      });
      entryMindMapByJournalId[journalId] = await getEntryMindMap(journalId, userId);

      console.info(`captured entry ${entry.dayOffset}`);
    }

    if (!capturedGuidedFlow) {
      throw new Error("The designated Guided Reflection flow was not captured.");
    }

    await rebuildInsightsCache(userId);
    await markUserMindMapStale(userId);
    const insightsOverview = await getInsightsOverview(userId);
    const weeklyAnalysis = await getInsightsAiAnalysis(userId, {
      timeZone: TIME_ZONE,
      today: captureAnchor,
    });
    if (weeklyAnalysis.status !== "ready") {
      throw new Error(`Weekly analysis captured as ${weeklyAnalysis.status}, not ready.`);
    }

    const mindMaps = {};
    const regionSeries = {};
    for (const range of ["latest_week", "monthly", "all_time"]) {
      const mindMap = await getInsightsMindMap(userId, {
        range,
        timeZone: TIME_ZONE,
        today: captureAnchor,
      });
      if (mindMap.status !== "ready") {
        throw new Error(`Mind Map ${range} captured as ${mindMap.status}, not ready.`);
      }
      mindMaps[range] = mindMap;
      for (const region of mindMap.regions) {
        regionSeries[`${range}:${region.id}`] =
          await getInsightsMindMapRegionSeries(userId, {
            regionId: region.id,
            range,
            timeZone: TIME_ZONE,
            today: captureAnchor,
          });
      }
    }

    const askJade = [];
    for (const question of scenario.askJadeQuestions) {
      const result = await sendJadeMessage({ userId, text: question, timeZone: TIME_ZONE });
      if (result.reply.status === "fallback") {
        throw new Error(`Ask Jade fell back for question: ${question}`);
      }
      askJade.push({ question, reply: result.reply });
    }
    const fallbackResult = await sendJadeMessage({
      userId,
      text: scenario.askJadeFallbackQuestion,
      timeZone: TIME_ZONE,
    });
    if (fallbackResult.reply.status === "fallback") {
      throw new Error("Ask Jade's generic fallback capture used a product fallback.");
    }

    const goalJournalId = journalByOffset.get(scenario.goalSourceDayOffset);
    if (!goalJournalId) throw new Error("Goal source entry was not created.");
    const goalSuggestions = await createGoalSuggestions({ userId, journalId: goalJournalId });
    if (goalSuggestions.suggestions.length === 0) {
      throw new Error(
        "The real goal pipeline returned no suggestions. Improve the input or prompt and re-capture.",
      );
    }
    for (const suggestion of goalSuggestions.suggestions) {
      await createGoal({
        userId,
        ...suggestion,
        today: toLocalDateKey(captureAnchor),
      });
    }
    const goals = (await getGoals({
      userId,
      today: toLocalDateKey(captureAnchor),
    })).goals;

    const failures = auditEvents.filter(event => event.outcome === "failure");
    if (failures.length) {
      throw new Error(
        `OpenAI failures occurred during capture: ${failures
          .map(event => `${event.feature}:${event.failure}`)
          .join(", ")}`,
      );
    }
    const requiredFeatures = [
      "first guided reflection summary",
      "guided reflection go deeper",
      "guided reflection session analysis",
      "mind map entry insight",
      "weekly ai analysis",
      "ask jade reply",
      "journal entry goal suggestions",
    ];
    const missingFeatures = requiredFeatures.filter(feature => !sourceModels.has(feature));
    if (missingFeatures.length) {
      throw new Error(`Required AI features did not run: ${missingFeatures.join(", ")}`);
    }

    const profile = {
      userId,
      name: "Demo Journaler",
      phoneNumber: null,
      email: `demo+${SCENARIO_ID}@journalio.invalid`,
      createdAt: user.createdAt.toISOString(),
      isPremium: true,
      premiumPlanKey: "lifetime",
      premiumActivatedAt: premiumActivatedAt.toISOString(),
      premiumProductId: null,
      premiumExpiresAt: null,
      premiumWillRenew: false,
      premiumVerifiedAt: captureAnchor.toISOString(),
      premiumRevenueCatRequestDate: captureAnchor.toISOString(),
      revenueCatAppUserId: null,
      premiumSource: "revenuecat_verified",
      journalingGoals: [],
      avatarColor: null,
      profileSetupCompleted: true,
      onboardingCompleted: true,
      onboardingVersion: 2,
      onboardingCompletedAt: premiumActivatedAt.toISOString(),
      hasJournalEntries: true,
      journalCount: capturedEntries.length,
      profilePic: null,
    };
    const captured = normalizeCapturedDates(
      {
        profile,
        journals: {
          entries: capturedEntries,
          quickAnalysisByJournalId,
          sessionAnalysisByJournalId,
          entryMindMapByJournalId,
        },
        moodCheckIns,
        insightsOverview,
        weeklyAnalysis,
        mindMaps,
        regionSeries,
        goals,
        goalSuggestionsByJournalId: {
          [goalJournalId]: goalSuggestions,
        },
        guidedFlow: capturedGuidedFlow,
        askJade,
        askJadeFallback: {
          question: scenario.askJadeFallbackQuestion,
          reply: fallbackResult.reply,
        },
      },
      captureAnchor,
    );
    const nextFixture = {
      ...scenario,
      status: "captured",
      generatedAt: captureAnchor.toISOString(),
      sourceModels: Object.fromEntries(
        [...sourceModels.entries()].map(([feature, models]) => [
          feature,
          [...models].sort(),
        ]),
      ),
      captureVersion: 1,
      inputHash: sha256(authoredHashInput(scenario)),
      outputHash: sha256(captured),
      captured,
    };
    const temporaryPath = `${fixturePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(nextFixture, null, 2)}\n`, "utf8");
    await rename(temporaryPath, fixturePath);
    console.info(`captured ${SCENARIO_ID} with ${databaseName}`);
  } finally {
    if (mongoose?.connection?.readyState) {
      await mongoose.connection.dropDatabase().catch(() => undefined);
      await mongoose.disconnect().catch(() => undefined);
    }
  }
};

run().catch(error => {
  console.error(error instanceof Error ? error.message : "Demo capture failed.");
  process.exitCode = 1;
});
