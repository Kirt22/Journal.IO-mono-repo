import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { journalModel } from "../../schema/journal.schema";
import { userModel } from "../../schema/user.schema";
import {
  getJournalQuickAnalysis,
  PremiumQuickAnalysisRequiredError,
  PremiumTagSuggestionsRequiredError,
  QuickAnalysisDisabledError,
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
  findOne: (query: unknown) => {
    exec: () => Promise<unknown>;
  };
};

const originalFindById = userTarget.findById;
const originalJournalFindOne = journalTarget.findOne;
const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;

const mockUserAiAccess = (isPremium: boolean, aiOptIn = true) => {
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium,
          onboardingContext: {
            aiOptIn,
          },
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
        "Premium membership is required for AI tag suggestions."
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
        "Premium membership is required for quick analysis."
      );
      return true;
    }
  );
});

test("getJournalQuickAnalysis rejects opted-out users", async () => {
  mockUserAiAccess(true, false);

  await assert.rejects(
    () =>
      getJournalQuickAnalysis({
        userId: "user-1",
        journalId: "journal-1",
      }),
    (error: unknown) => {
      assert.ok(error instanceof QuickAnalysisDisabledError);
      assert.equal(
        (error as Error).message,
        "Quick analysis is turned off for this account."
      );
      return true;
    }
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
