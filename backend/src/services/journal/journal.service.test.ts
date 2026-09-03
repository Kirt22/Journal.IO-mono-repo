import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { journalModel } from "../../schema/journal.schema";
import { userModel } from "../../schema/user.schema";
import {
  getJournals,
  getJournalQuickAnalysis,
  getJournalSessionAnalysis,
  InvalidJournalCursorError,
  PremiumQuickAnalysisRequiredError,
  PremiumSessionAnalysisRequiredError,
  PremiumTagSuggestionsRequiredError,
  serializeJournal,
  SessionAnalysisUnavailableError,
  suggestJournalTags,
} from "./journal.service";

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
const journalTarget = journalModel as unknown as {
  findOneAndUpdate?: (...args: unknown[]) => { exec: () => Promise<unknown> };
  findOne: (query: unknown) => {
    exec: () => Promise<unknown>;
  };
};

const originalFindById = userTarget.findById;
const originalJournalFindOne = journalTarget.findOne;
const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;

const mockUserAiAccess = (isPremium: boolean) => {
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium,
          ...(isPremium
            ? {
                premiumPlanKey: "yearly",
                premiumExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
                premiumSource: "revenuecat_verified",
              }
            : {}),
        }),
      }),
    }),
  });
};

beforeEach(() => {
  mockUserAiAccess(true);
});

afterEach(() => {
  userTarget.findById = originalFindById;
  journalTarget.findOne = originalJournalFindOne;
  globalThis.fetch = originalFetch;

  if (typeof originalApiKey === "string") {
    process.env.OPENAI_API_KEY = originalApiKey;
  } else {
    delete process.env.OPENAI_API_KEY;
  }
});

test("serializeJournal omits reserved onboarding metadata tags", () => {
  const result = serializeJournal({
    toObject: () => ({
      _id: "journal-1",
      title: "First reflection",
      content: "I noticed anxiety and loneliness today.",
      type: "guided",
      entryKind: "journal",
      aiPrompt: "Onboarding first guided reflection",
      tags: ["onboarding:first-reflection", "reflection"],
      detectedTopics: ["anxiety", "loneliness"],
      detectedMood: "bad",
      images: [],
      isFavorite: false,
      createdAt: new Date("2026-08-03T10:00:00.000Z"),
      updatedAt: new Date("2026-08-03T10:00:00.000Z"),
    }),
  } as Parameters<typeof serializeJournal>[0]);

  assert.deepEqual(result.tags, ["reflection"]);
  assert.deepEqual(result.detectedTopics, ["anxiety", "loneliness"]);
});

test("suggestJournalTags rejects non-premium users before generating suggestions", async () => {
  mockUserAiAccess(false);

  await assert.rejects(
    () =>
      suggestJournalTags({
        userId: "user-1",
        content: "I felt worn out and wanted help naming this day.",
      }),
    (error: unknown) => {
      assert.ok(error instanceof PremiumTagSuggestionsRequiredError);
      assert.equal(
        (error as Error).message,
        "AI tag suggestions are available with Premium."
      );
      return true;
    }
  );
});

test("getJournalQuickAnalysis rejects non-premium users", async () => {
  mockUserAiAccess(false);

  await assert.rejects(
    () =>
      getJournalQuickAnalysis({
        userId: "user-1",
        journalId: "journal-1",
      }),
    (error: unknown) => {
      assert.ok(error instanceof PremiumQuickAnalysisRequiredError);
      assert.equal(
        (error as Error).message,
        "Quick analysis is available with Premium."
      );
      return true;
    }
  );
});

test("getJournalSessionAnalysis rejects non-premium users before reading an entry", async () => {
  mockUserAiAccess(false);
  let journalRead = false;
  journalTarget.findOne = () => ({
    exec: async () => {
      journalRead = true;
      return null;
    },
  });

  await assert.rejects(
    () =>
      getJournalSessionAnalysis({
        userId: "user-1",
        journalId: "journal-1",
      }),
    (error: unknown) => {
      assert.ok(error instanceof PremiumSessionAnalysisRequiredError);
      return true;
    }
  );
  assert.equal(journalRead, false);
});

test("getJournalSessionAnalysis replays the saved snapshot without regenerating", async () => {
  const savedAnalysis = {
    analysis: "This session suggests a calmer response to pressure.",
    majorInsight: "A small pause appeared associated with more steadiness.",
    observedTrends: ["Calm"],
    triggersObserved: [],
    patternAssessment: [],
    detectedTopics: ["calm"],
    detectedMood: "good",
    brainSessionMap: {
      dominantCenterId: "planning_self_control",
      dominantCenter: {},
      secondaryCenterIds: [],
      secondaryCenters: [],
      centers: [],
      neuroscienceSummary: "Saved map",
      mostNoticedText: "Planning stood out.",
      mindMapSeedText: "A planning signal was saved.",
    },
    hasEnoughSignal: true,
  };
  journalTarget.findOne = () => ({
    exec: async () => ({
      title: "A calmer afternoon",
      entryKind: "journal",
      sessionAnalysisSnapshot: { analysis: savedAnalysis },
    }),
  });

  const result = await getJournalSessionAnalysis({
    userId: "user-1",
    journalId: "journal-1",
  });

  assert.equal(result, savedAnalysis);
});

test("getJournalSessionAnalysis excludes Quick Notes", async () => {
  journalTarget.findOne = () => ({
    exec: async () => ({
      title: "Quick Thought",
      entryKind: "quick_thought",
      sessionAnalysisSnapshot: null,
    }),
  });

  await assert.rejects(
    () =>
      getJournalSessionAnalysis({
        userId: "user-1",
        journalId: "journal-1",
      }),
    SessionAnalysisUnavailableError
  );
});

test("getJournals rejects malformed cursors before querying journals", async () => {
  await assert.rejects(
    () =>
      getJournals({
        userId: "user-1",
        limit: 10,
        cursor: "not-a-valid-cursor",
      }),
    InvalidJournalCursorError
  );
});

test("getJournalQuickAnalysis returns a short heuristic reflection for a saved entry", async () => {
  journalTarget.findOne = () => ({
    exec: async () => ({
      _id: {
        toString: () => "journal-1",
      },
      title: "Tough workday",
      type: "journal",
      content:
        "Work felt heavy today and I noticed a lot of anxiety before the meeting. I needed a slower evening and more self-care after that.",
      tags: ["work", "self-care", "mood:bad"],
    }),
  });

  const analysis = await getJournalQuickAnalysis({
    userId: "user-1",
    journalId: "journal-1",
  });

  assert.ok(analysis);
  assert.equal(analysis?.journalId, "journal-1");
  assert.equal(analysis?.summary.headline, "Work carried this bad moment");
  assert.equal(analysis?.scorecard.cards[1]?.value, "Bad");
  assert.equal(analysis?.patternTags[0]?.label, "Work");
  assert.match(analysis?.summary.narrative || "", /work/i);
  assert.equal(analysis?.signals.whatNeedsCare.tone, "slate");
  assert.equal(analysis?.nextStep.focus, "Support");
});

test("getJournalQuickAnalysis marks prompt-led gibberish as low signal", async () => {
  journalTarget.findOne = () => ({
    exec: async () => ({
      _id: {
        toString: () => "journal-2",
      },
      title: "Trying to answer",
      type: "journal",
      content: "What felt most steady or grounding in your day?\n\nasdf qwer",
      aiPrompt: "What felt most steady or grounding in your day?",
      tags: ["work", "mood:okay"],
    }),
  });

  const analysis = await getJournalQuickAnalysis({
    userId: "user-1",
    journalId: "journal-2",
  });

  assert.ok(analysis);
  assert.equal(analysis?.summary.headline, "This entry is still mostly prompt carryover");
  assert.equal(analysis?.scorecard.vibeLabel, "Prompt-led note");
  assert.equal(analysis?.scorecard.cards[2]?.value, "Prompt carryover");
  assert.equal(analysis?.patternTags[0]?.label, "Prompt Carryover");
  assert.match(analysis?.signals.whatNeedsCare.title || "", /clearer pass/i);
  assert.equal(analysis?.nextStep.focus, "Specificity");
});

test("getJournalQuickAnalysis keeps safety-sensitive entries support-first", async () => {
  journalTarget.findOne = () => ({
    exec: async () => ({
      _id: {
        toString: () => "journal-safety",
      },
      title: "Not safe",
      type: "journal",
      content:
        "I do not want to live and I keep thinking I might kill myself tonight.",
      aiPrompt: null,
      tags: ["mood:terrible"],
    }),
  });

  const analysis = await getJournalQuickAnalysis({
    userId: "user-1",
    journalId: "journal-safety",
  });

  assert.ok(analysis);
  assert.equal(analysis?.summary.headline, "This entry needs real-world support");
  assert.match(analysis?.summary.narrative || "", /will not turn this into/i);
  assert.match(analysis?.summary.highlight || "", /988/i);
  assert.equal(analysis?.scorecard.vibeLabel, "Urgent support");
  assert.equal(analysis?.patternTags[0]?.label, "Safety");
  assert.equal(analysis?.nextStep.focus, "Safety");
});

test("getJournalQuickAnalysis keeps harm-to-others wording out of normal pattern analysis", async () => {
  journalTarget.findOne = () => ({
    exec: async () => ({
      _id: {
        toString: () => "journal-harm",
      },
      title: "Angry",
      type: "journal",
      content:
        "I am so angry that I want to kill him and I need to write this down before I do anything.",
      aiPrompt: null,
      tags: ["anger", "mood:terrible"],
    }),
  });

  const analysis = await getJournalQuickAnalysis({
    userId: "user-1",
    journalId: "journal-harm",
  });

  assert.ok(analysis);
  assert.equal(analysis?.summary.headline, "This entry needs a safety-first response");
  assert.match(analysis?.summary.highlight || "", /emergency services/i);
  assert.equal(analysis?.patternTags[0]?.label, "Safety");
  assert.equal(analysis?.nextStep.focus, "Safety");
});

test("suggestJournalTags returns ranked tags and excludes already selected tags", async () => {
  const result = await suggestJournalTags({
    userId: "user-1",
    content:
      "I felt grateful after a calm morning. Work was still stressful, but I learned from the meeting and felt thankful by the end.",
    selectedTags: ["work"],
  });

  assert.deepEqual(result.tags, [
    "gratitude",
    "mindfulness",
    "morning",
  ]);
});

test("suggestJournalTags falls back to reflection for longer uncategorized entries", async () => {
  const result = await suggestJournalTags({
    userId: "user-1",
    content:
      "Spent some time writing through the day and trying to understand what felt different compared with last week.",
  });

  assert.deepEqual(result.tags, ["reflection"]);
});

test("suggestJournalTags returns an empty list when nothing new can be suggested", async () => {
  const result = await suggestJournalTags({
    userId: "user-1",
    content: "Notebook.",
    selectedTags: ["reflection"],
  });

  assert.deepEqual(result.tags, []);
});

test("suggestJournalTags avoids positive tags when the language is negated and mood is low", async () => {
  const result = await suggestJournalTags({
    userId: "user-1",
    content:
      "What are you grateful for today? not that grateful too tired and not feeling well.",
    mood: "bad",
  });

  assert.equal(result.tags.includes("gratitude"), false);
  assert.equal(result.tags.includes("self-care"), true);
  assert.equal(result.tags.includes("sadness"), true);
});

test("suggestJournalTags uses OpenAI-selected tags when available and still keeps deterministic fallback ordering", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  mockUserAiAccess(true);
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          tags: ["self-care", "sadness"],
        }),
      }),
      { status: 200 }
    )) as typeof fetch;

  const result = await suggestJournalTags({
    userId: "user-1",
    content:
      "What are you grateful for today? not that grateful too tired and not feeling well.",
    mood: "bad",
  });

  assert.deepEqual(result.tags, ["self-care", "sadness"]);
});

test("a guided entry is re-analysed from the user's words, not the whole blob", async () => {
  // The saved guided entry is one blob of mixed authorship. Feeding it whole is
  // how Journal.IO's own reflection gets read back as the person's writing.
  const jadeReflection =
    "Protecting your morning seems tied to the focused hour you keep reaching for.";
  const guidedBlob = [
    "One good or exciting thing from today:\nI finished the deck before lunch.",
    "One hurdle or stressful moment:\nMy manager messaged me and I went quiet.",
    `Journal.IO reflection:\n${jadeReflection}`,
    "Going deeper:\nQuestion:\nWhat gets in the way?\nMy response:\nI put it off until the afternoon.",
  ].join("\n\n");

  mockUserAiAccess(true);
  const guidedDoc = () => ({
      _id: "journal-1",
      title: "Today's reflection",
      entryKind: "journal",
      type: "guided",
      content: guidedBlob,
      aiPrompt: "Onboarding first guided reflection",
      appAuthoredSegments: [
        "One good or exciting thing from today:",
        "One hurdle or stressful moment:",
        "Journal.IO reflection:",
        "Going deeper:",
        "Question:",
        "My response:",
        jadeReflection,
        "What gets in the way?",
      ],
      sessionAnalysisSnapshot: null,
      createdAt: new Date("2026-08-10T00:00:00.000Z"),
      tags: [],
      detectedTopics: [],
      isFavorite: false,
      save: async () => undefined,
  });
  // Chainable: the read path uses .exec(), the persist path uses .select().
  journalTarget.findOne = () => {
    const chain: Record<string, unknown> = {
      exec: async () => guidedDoc(),
      select: () => chain,
      lean: () => chain,
    };
    return chain as { exec: () => Promise<unknown> };
  };
  // Echo the write back, the way Mongo's { new: true } would, so persist
  // returns the freshly generated analysis rather than falling through.
  journalTarget.findOneAndUpdate = (...args: unknown[]) => ({
    exec: async () => {
      const update = args[1] as {
        $set: { sessionAnalysisSnapshot: unknown };
      };
      return {
        ...guidedDoc(),
        sessionAnalysisSnapshot: update.$set.sessionAnalysisSnapshot,
        save: async () => undefined,
      };
    },
  });

  const analysis = await getJournalSessionAnalysis({
    userId: "user-1",
    journalId: "journal-1",
  });

  assert.ok(analysis);
  // Deterministic fallback (no OpenAI key in tests) quotes the user's own
  // sentences back. None of them may be Journal.IO's.
  assert.doesNotMatch(analysis.analysis, /Protecting your morning/i);
  assert.doesNotMatch(analysis.analysis, /What gets in the way/i);
  assert.doesNotMatch(analysis.analysis, /Journal\.IO reflection/i);
});
