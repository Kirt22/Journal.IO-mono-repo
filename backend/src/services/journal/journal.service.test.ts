import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { userModel } from "../../schema/user.schema";
import {
  PremiumTagSuggestionsRequiredError,
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

const originalFindById = userTarget.findById;
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
