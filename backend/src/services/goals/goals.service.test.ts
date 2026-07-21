import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { journalModel } from "../../schema/journal.schema";
import { userModel } from "../../schema/user.schema";
import {
  createGoal,
  createGoalSuggestions,
  deleteGoal,
  getGoals,
  GoalSuggestionsDisabledError,
  GoalSuggestionsPremiumRequiredError,
} from "./goals.service";

const userTarget = userModel as unknown as {
  findById: (value: string) => {
    select?: (projection: string) => {
      lean: () => {
        exec: () => Promise<unknown>;
      };
    };
    exec?: () => Promise<unknown>;
  };
};
const journalTarget = journalModel as unknown as {
  findOne: (value: unknown) => {
    select: (projection: string) => {
      lean: () => {
        exec: () => Promise<unknown>;
      };
    };
  };
};

const originalUserFindById = userTarget.findById;
const originalJournalFindOne = journalTarget.findOne;

afterEach(() => {
  userTarget.findById = originalUserFindById;
  journalTarget.findOne = originalJournalFindOne;
});

test("getGoals returns normalized active goals from the user profile", async () => {
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          journalingGoals: [" Write nightly ", "Write nightly", "Plan tomorrow"],
        }),
      }),
    }),
  });

  const result = await getGoals("user-1");

  assert.deepEqual(result.goals, [
    { id: "write-nightly", title: "Write nightly" },
    { id: "plan-tomorrow", title: "Plan tomorrow" },
  ]);
});

test("createGoal appends a new deduplicated goal to the user profile", async () => {
  const savedUser = {
    journalingGoals: ["Write nightly"],
    saveCalls: 0,
    save: async function save() {
      this.saveCalls += 1;
    },
  };

  userTarget.findById = () => ({
    exec: async () => savedUser,
  });

  const result = await createGoal({
    userId: "user-1",
    title: "Plan tomorrow",
  });

  assert.deepEqual(result, {
    id: "plan-tomorrow",
    title: "Plan tomorrow",
  });
  assert.deepEqual(savedUser.journalingGoals, ["Write nightly", "Plan tomorrow"]);
  assert.equal(savedUser.saveCalls, 1);
});

test("deleteGoal removes a saved goal by stable id", async () => {
  const savedUser = {
    journalingGoals: ["Write nightly", "Plan tomorrow"],
    saveCalls: 0,
    save: async function save() {
      this.saveCalls += 1;
    },
  };

  userTarget.findById = () => ({
    exec: async () => savedUser,
  });

  const deleted = await deleteGoal({
    userId: "user-1",
    goalId: "write-nightly",
  });

  assert.equal(deleted, true);
  assert.deepEqual(savedUser.journalingGoals, ["Plan tomorrow"]);
  assert.equal(savedUser.saveCalls, 1);
});

test("createGoalSuggestions rejects non-premium users", async () => {
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: false,
          onboardingContext: { aiOptIn: true },
        }),
      }),
    }),
  });

  await assert.rejects(
    () =>
      createGoalSuggestions({
        userId: "user-1",
        journalId: "journal-1",
      }),
    error => error instanceof GoalSuggestionsPremiumRequiredError
  );
});

test("createGoalSuggestions rejects opted-out users", async () => {
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: true,
          onboardingContext: { aiOptIn: false },
        }),
      }),
    }),
  });

  await assert.rejects(
    () =>
      createGoalSuggestions({
        userId: "user-1",
        journalId: "journal-1",
      }),
    error => error instanceof GoalSuggestionsDisabledError
  );
});

test("createGoalSuggestions falls back to safe practical suggestions from the entry", async () => {
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

  journalTarget.findOne = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          title: "Heavy workday",
          content:
            "Work felt heavy and stressful today. I want a calmer reset and one simpler plan for tomorrow.",
          tags: ["work", "self-care"],
        }),
      }),
    }),
  });

  const result = await createGoalSuggestions({
    userId: "user-1",
    journalId: "journal-1",
  });

  assert.equal(result.journalId, "journal-1");
  assert.equal(result.suggestions.length, 3);
  assert.match(result.suggestions[0]?.title || "", /pressure|reset|write|notice/i);
});
