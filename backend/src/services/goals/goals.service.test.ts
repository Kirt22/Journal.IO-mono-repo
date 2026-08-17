import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { journalModel } from "../../schema/journal.schema";
import { userModel } from "../../schema/user.schema";
import {
  createGoal,
  createGoalSuggestions,
  deleteGoal,
  getGoals,
  getSavedGoalSuggestionContext,
  GoalNotArchivedError,
  GoalSuggestionsPremiumRequiredError,
  setGoalCompletion,
  setGoalStatus,
  updateGoal,
} from "./goals.service";

const userTarget = userModel as unknown as {
  findById: (value: string) => {
    select?: (projection: string) => {
      lean?: () => { exec: () => Promise<unknown> };
      exec?: () => Promise<unknown>;
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

type FakeGoal = {
  id: string;
  title: string;
  description?: string | null;
  icon?: string;
  iconSource?: "automatic" | "fixed";
  frequency?: "daily" | "weekly" | "as_needed";
  // Includes the legacy values on purpose: these fixtures exercise the
  // migration path that drains them.
  status: "active" | "archived" | "completed" | "dismissed";
  reminderEnabled?: boolean;
  reminderTime?: string | null;
  lastCompletedLocalDate?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** A goal already in the current shape, so normalization is a no-op. */
const makeGoal = (overrides: Partial<FakeGoal> & { id: string; title: string }): FakeGoal => ({
  description: null,
  icon: "target",
  iconSource: "fixed",
  frequency: "as_needed",
  status: "active",
  reminderEnabled: false,
  reminderTime: null,
  lastCompletedLocalDate: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const makeUser = (overrides: {
  journalingGoals?: string[];
  goals?: FakeGoal[];
}) => ({
  journalingGoals: overrides.journalingGoals ?? [],
  goals: overrides.goals ?? [],
  saveCalls: 0,
  markModifiedCalls: [] as string[],
  markModified(path: string) {
    this.markModifiedCalls.push(path);
  },
  save: async function save() {
    this.saveCalls += 1;
  },
});

afterEach(() => {
  userTarget.findById = originalUserFindById;
  journalTarget.findOne = originalJournalFindOne;
});

test("getGoals seeds structured goals from legacy journalingGoals", async () => {
  const savedUser = makeUser({
    journalingGoals: [" Write nightly ", "Write nightly", "Plan tomorrow"],
  });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await getGoals({ userId: "user-1", today: "2026-08-05" });

  assert.equal(result.goals.length, 2);
  // Newest first: the most recently added legacy goal sorts first.
  assert.equal(result.goals[0]?.title, "Plan tomorrow");
  assert.equal(result.goals[1]?.title, "Write nightly");
  assert.equal(result.goals[0]?.status, "active");
  assert.ok(result.goals[0]?.id);
  assert.ok(result.goals[0]?.createdAt);
  assert.equal(savedUser.goals.length, 2);
  assert.equal(savedUser.saveCalls, 1);
  // Legacy goals get a keyword-matched icon for free — no AI call.
  assert.equal(result.goals[0]?.icon, "plan", "Plan tomorrow -> plan");
  assert.equal(result.goals[1]?.icon, "write", "Write nightly -> write");
  // A seeded goal must not look already-done.
  assert.equal(result.goals[0]?.frequency, "as_needed");
  assert.equal(result.goals[0]?.isCompletedForPeriod, false);
});

test("getGoals returns existing structured goals sorted newest first", async () => {
  const older = makeGoal({
    id: "a",
    title: "Old goal",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const newer = makeGoal({
    id: "b",
    title: "New goal",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
  });
  const savedUser = makeUser({
    journalingGoals: ["ignored legacy"],
    goals: [older, newer],
  });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await getGoals({ userId: "user-1", today: "2026-08-05" });

  assert.deepEqual(
    result.goals.map((goal) => goal.id),
    ["b", "a"]
  );
  assert.equal(result.goals[0]?.status, "active");
  // Already in the current shape, so nothing to migrate and nothing to save.
  assert.equal(savedUser.saveCalls, 0);
});

test("getGoals migrates a legacy completed goal into a per-period completion", async () => {
  const savedUser = makeUser({
    goals: [
      {
        id: "x",
        title: "Ship the thing",
        status: "completed",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-02-03T10:00:00.000Z"),
      },
    ],
  });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await getGoals({ userId: "user-1", today: "2026-08-05" });

  // `completed` is no longer a status; it becomes an as_needed goal that is
  // already done. The date is derived from updatedAt, which is lossless because
  // as_needed only checks the field for presence.
  assert.equal(result.goals[0]?.status, "active");
  assert.equal(result.goals[0]?.frequency, "as_needed");
  assert.equal(result.goals[0]?.lastCompletedLocalDate, "2026-02-03");
  assert.equal(result.goals[0]?.isCompletedForPeriod, true);
  assert.equal(savedUser.saveCalls, 1, "migration persists");
  assert.ok(savedUser.markModifiedCalls.includes("goals"));
});

test("getGoals migrates a legacy dismissed goal into archived", async () => {
  const savedUser = makeUser({
    goals: [
      {
        id: "x",
        title: "Old idea",
        status: "dismissed",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
  });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await getGoals({ userId: "user-1", today: "2026-08-05" });

  assert.equal(result.goals[0]?.status, "archived");
  assert.equal(result.goals[0]?.isCompletedForPeriod, false);
  assert.equal(savedUser.saveCalls, 1);
});

test("getGoals derives daily completion against the client's local date", async () => {
  const savedUser = makeUser({
    goals: [
      makeGoal({
        id: "x",
        title: "Journal every evening",
        frequency: "daily",
        lastCompletedLocalDate: "2026-08-05",
      }),
    ],
  });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const done = await getGoals({ userId: "user-1", today: "2026-08-05" });
  assert.equal(done.goals[0]?.isCompletedForPeriod, true);

  const nextDay = await getGoals({ userId: "user-1", today: "2026-08-06" });
  assert.equal(nextDay.goals[0]?.isCompletedForPeriod, false, "daily goals come back");
});

test("createGoal appends a new normalized active goal", async () => {
  const savedUser = makeUser({});

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await createGoal({
    userId: "user-1",
    title: "  Plan   tomorrow ",
  });

  assert.equal(result.title, "Plan tomorrow");
  assert.equal(result.status, "active");
  assert.ok(result.id);
  assert.ok(result.createdAt);
  // No icon supplied, so the keyword matcher fills it in.
  assert.equal(result.icon, "plan");
  assert.equal(result.iconSource, "automatic");
  assert.equal(result.frequency, "as_needed");
  assert.equal(result.reminderEnabled, false);
  assert.equal(result.reminderTime, null);
  assert.equal(result.isCompletedForPeriod, false);
  assert.equal(savedUser.goals.length, 1);
  assert.equal(savedUser.saveCalls, 1);
});

test("createGoal stores the full draft when one is supplied", async () => {
  const savedUser = makeUser({});

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await createGoal({
    userId: "user-1",
    title: "Gym session",
    description: "  Twenty   minutes is enough.  ",
    icon: "code",
    frequency: "weekly",
    reminderEnabled: true,
    reminderTime: "19:30",
  });

  assert.equal(result.description, "Twenty minutes is enough.");
  // An explicit icon wins over the keyword match ("gym").
  assert.equal(result.icon, "code");
  assert.equal(result.iconSource, "fixed");
  assert.equal(result.frequency, "weekly");
  assert.equal(result.reminderEnabled, true);
  assert.equal(result.reminderTime, "19:30");
});

test("createGoal rejects an unusable reminder time", async () => {
  const savedUser = makeUser({});

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await createGoal({
    userId: "user-1",
    title: "Stretch",
    reminderEnabled: true,
    reminderTime: "25:99",
  });

  assert.equal(result.reminderTime, null);
});

test("createGoal merges the payload into a duplicate active title", async () => {
  const existing = makeGoal({ id: "x", title: "Plan tomorrow" });
  const savedUser = makeUser({ goals: [existing] });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await createGoal({
    userId: "user-1",
    title: "plan tomorrow",
    frequency: "daily",
    reminderEnabled: true,
    reminderTime: "21:00",
  });

  // Still one goal — but the incoming payload is applied rather than discarded.
  // Silently ignoring it used to lose the caller's reminder ("I set a reminder
  // and it didn't stick").
  assert.equal(result.id, "x");
  assert.equal(savedUser.goals.length, 1);
  assert.equal(result.frequency, "daily");
  assert.equal(result.reminderEnabled, true);
  assert.equal(result.reminderTime, "21:00");
  assert.equal(savedUser.saveCalls, 1);
});

test("updateGoal renames a goal by its stable id", async () => {
  const goal = makeGoal({ id: "x", title: "Old title" });
  const savedUser = makeUser({ goals: [goal] });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await updateGoal({
    userId: "user-1",
    goalId: "x",
    title: "New title",
  });

  assert.equal(result?.title, "New title");
  assert.equal(goal.title, "New title");
  assert.equal(savedUser.saveCalls, 1);
});

test("updateGoal follows title changes only for automatic icons", async () => {
  const automaticGoal = makeGoal({
    id: "automatic",
    title: "Journal every evening",
    icon: "journal",
    iconSource: "automatic",
  });
  const fixedGoal = makeGoal({
    id: "fixed",
    title: "Journal every evening",
    icon: "music",
    iconSource: "fixed",
  });
  const savedUser = makeUser({ goals: [automaticGoal, fixedGoal] });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const automaticResult = await updateGoal({
    userId: "user-1",
    goalId: "automatic",
    title: "Walk after lunch",
  });
  const fixedResult = await updateGoal({
    userId: "user-1",
    goalId: "fixed",
    title: "Walk after lunch",
  });

  assert.equal(automaticResult?.iconSource, "automatic");
  assert.equal(automaticResult?.icon, "walk");
  assert.equal(fixedResult?.iconSource, "fixed");
  assert.equal(fixedResult?.icon, "music");
});

test("legacy automatic icons avoid fixed icons regardless of stored order", async () => {
  const savedUser = makeUser({
    goals: [
      {
        id: "automatic",
        title: "Journal at night",
        icon: "target",
        status: "active",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "fixed",
        title: "A personal ritual",
        icon: "journal",
        status: "active",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ],
  });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await getGoals({ userId: "user-1", today: "2026-08-06" });
  const automatic = result.goals.find(goal => goal.id === "automatic");
  const fixed = result.goals.find(goal => goal.id === "fixed");

  assert.equal(automatic?.iconSource, "automatic");
  assert.notEqual(automatic?.icon, "journal");
  assert.equal(fixed?.iconSource, "fixed");
  assert.equal(fixed?.icon, "journal");
});

test("updateGoal leaves untouched fields alone", async () => {
  const goal = makeGoal({
    id: "x",
    title: "Gym session",
    description: "Twenty minutes.",
    icon: "gym",
    frequency: "weekly",
    reminderEnabled: true,
    reminderTime: "19:30",
  });
  const savedUser = makeUser({ goals: [goal] });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await updateGoal({
    userId: "user-1",
    goalId: "x",
    frequency: "daily",
  });

  assert.equal(result?.frequency, "daily");
  assert.equal(result?.title, "Gym session", "title untouched");
  assert.equal(result?.description, "Twenty minutes.", "description untouched");
  assert.equal(result?.icon, "gym", "icon untouched");
  assert.equal(result?.reminderEnabled, true, "reminder untouched");
  assert.equal(result?.reminderTime, "19:30", "reminder time untouched");
});

test("updateGoal can clear a description and a reminder time", async () => {
  const goal = makeGoal({
    id: "x",
    title: "Gym session",
    description: "Twenty minutes.",
    reminderEnabled: true,
    reminderTime: "19:30",
  });
  const savedUser = makeUser({ goals: [goal] });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await updateGoal({
    userId: "user-1",
    goalId: "x",
    description: null,
    reminderEnabled: false,
    reminderTime: null,
  });

  assert.equal(result?.description, null);
  assert.equal(result?.reminderEnabled, false);
  assert.equal(result?.reminderTime, null);
});

test("updateGoal returns null when the goal is missing", async () => {
  const savedUser = makeUser({});

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await updateGoal({
    userId: "user-1",
    goalId: "missing",
    title: "New title",
  });

  assert.equal(result, null);
  assert.equal(savedUser.saveCalls, 0);
});

test("setGoalStatus archives a goal and keeps its reminder intact", async () => {
  const goal = makeGoal({
    id: "x",
    title: "Goal",
    reminderEnabled: true,
    reminderTime: "21:00",
  });
  const savedUser = makeUser({ goals: [goal] });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await setGoalStatus({
    userId: "user-1",
    goalId: "x",
    status: "archived",
  });

  assert.equal(result?.status, "archived");
  assert.equal(goal.status, "archived");
  // The scheduler filters on status, so leaving the flag set means unarchiving
  // restores the reminder for free.
  assert.equal(result?.reminderEnabled, true);
  assert.equal(result?.reminderTime, "21:00");
  assert.equal(savedUser.saveCalls, 1);
});

test("setGoalStatus unarchives a goal", async () => {
  const goal = makeGoal({ id: "x", title: "Goal", status: "archived" });
  const savedUser = makeUser({ goals: [goal] });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await setGoalStatus({
    userId: "user-1",
    goalId: "x",
    status: "active",
  });

  assert.equal(result?.status, "active");
});

test("setGoalStatus returns null when the goal is missing", async () => {
  const savedUser = makeUser({});

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await setGoalStatus({
    userId: "user-1",
    goalId: "missing",
    status: "archived",
  });

  assert.equal(result, null);
});

test("setGoalCompletion records and clears a completion", async () => {
  const goal = makeGoal({ id: "x", title: "Journal", frequency: "daily" });
  const savedUser = makeUser({ goals: [goal] });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const done = await setGoalCompletion({
    userId: "user-1",
    goalId: "x",
    completed: true,
    localDate: "2026-08-05",
  });

  assert.equal(done?.lastCompletedLocalDate, "2026-08-05");
  assert.equal(done?.isCompletedForPeriod, true);
  // Status is untouched — completion is not a status any more.
  assert.equal(done?.status, "active");

  const undone = await setGoalCompletion({
    userId: "user-1",
    goalId: "x",
    completed: false,
    today: "2026-08-05",
  });

  assert.equal(undone?.lastCompletedLocalDate, null);
  assert.equal(undone?.isCompletedForPeriod, false);
});

test("setGoalCompletion returns null when the goal is missing", async () => {
  const savedUser = makeUser({});

  userTarget.findById = () => ({ exec: async () => savedUser });

  const result = await setGoalCompletion({
    userId: "user-1",
    goalId: "missing",
    completed: true,
    localDate: "2026-08-05",
  });

  assert.equal(result, null);
});

test("deleteGoal removes an archived goal by its stable id", async () => {
  const goal = makeGoal({ id: "x", title: "Goal", status: "archived" });
  const savedUser = makeUser({ goals: [goal] });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const deleted = await deleteGoal({
    userId: "user-1",
    goalId: "x",
  });

  assert.equal(deleted, true);
  assert.equal(savedUser.goals.length, 0);
  assert.equal(savedUser.saveCalls, 1);
});

test("deleteGoal refuses to hard-delete a goal that is not archived", async () => {
  const goal = makeGoal({ id: "x", title: "Goal" });
  const savedUser = makeUser({ goals: [goal] });

  userTarget.findById = () => ({ exec: async () => savedUser });

  // The UI only offers Delete from an archived goal's sheet, but enforcing it in
  // the service means a future UI slip can never destroy user data.
  await assert.rejects(
    () => deleteGoal({ userId: "user-1", goalId: "x" }),
    (error) => error instanceof GoalNotArchivedError
  );
  assert.equal(savedUser.goals.length, 1);
});

test("deleteGoal returns false when the goal is missing", async () => {
  const goal = makeGoal({ id: "x", title: "Goal", status: "archived" });
  const savedUser = makeUser({ goals: [goal] });

  userTarget.findById = () => ({ exec: async () => savedUser });

  const deleted = await deleteGoal({
    userId: "user-1",
    goalId: "missing",
  });

  assert.equal(deleted, false);
  assert.equal(savedUser.goals.length, 1);
});

test("suggestion context includes active and archived goals", async () => {
  const savedUser = makeUser({
    goals: [
      makeGoal({ id: "active", title: "Walk after lunch", icon: "walk" }),
      makeGoal({
        id: "archived",
        title: "Journal in the evening",
        icon: "journal",
        status: "archived",
      }),
    ],
  });

  userTarget.findById = () => ({
    select: () => ({ exec: async () => savedUser }),
  });

  const context = await getSavedGoalSuggestionContext("user-1");

  assert.deepEqual(
    context.goals.map(goal => ({ title: goal.title, status: goal.status })),
    [
      { title: "Walk after lunch", status: "active" },
      { title: "Journal in the evening", status: "archived" },
    ]
  );
});

test("createGoalSuggestions rejects non-premium users", async () => {
  userTarget.findById = () => ({
    select: () => ({
      exec: async () => ({
        isPremium: false,
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

test("createGoalSuggestions falls back to safe practical suggestions from the entry", async () => {
  userTarget.findById = () => ({
    select: () => ({
      exec: async () => ({
        isPremium: true,
        premiumPlanKey: "yearly",
        premiumExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
        premiumSource: "revenuecat_verified",
        goals: [],
        journalingGoals: [],
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
  // Fallbacks must satisfy the same shape the AI path returns, or the client
  // has to special-case them.
  for (const suggestion of result.suggestions) {
    assert.ok(suggestion.icon, "every fallback carries an icon");
    assert.ok(
      ["daily", "weekly", "as_needed"].includes(suggestion.frequency),
      "every fallback carries a frequency"
    );
  }
});

test("a general entry falls back to baseline life goals, not journaling prompts", async () => {
  userTarget.findById = () => ({
    select: () => ({
      exec: async () => ({
        isPremium: true,
        premiumPlanKey: "yearly",
        premiumExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
        premiumSource: "revenuecat_verified",
        goals: [],
        journalingGoals: [],
      }),
    }),
  });

  journalTarget.findOne = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          title: "Just a day",
          content:
            "Today was fine I guess. Work was work, same as usual, nothing much happened. " +
            "Got home, sat around, whatever. Just another day really, same old thing.",
          tags: [],
        }),
      }),
    }),
  });

  const result = await createGoalSuggestions({
    userId: "user-1",
    journalId: "journal-1",
  });

  assert.equal(result.suggestions.length, 3);
  assert.equal(result.suggestions[0]?.title, "Walk 20 minutes");
  assert.equal(
    result.suggestions.some(suggestion => /write|journal|reflect/i.test(suggestion.title)),
    false,
    "a general entry gets body-and-routine advice rather than more writing"
  );
});

test("suggestions are topped up when saved goals already cover the entry", async () => {
  userTarget.findById = () => ({
    select: () => ({
      exec: async () => ({
        isPremium: true,
        premiumPlanKey: "yearly",
        premiumExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
        premiumSource: "revenuecat_verified",
        // Covers every goal the stress-flavoured keyword fallback produces.
        goals: [
          makeGoal({ id: "g1", title: "Notice one pressure point", icon: "anxiety" }),
          makeGoal({ id: "g2", title: "Add one softer reset", icon: "calm" }),
          makeGoal({
            id: "g3",
            title: "Close the day in one sentence",
            icon: "journal",
          }),
        ],
        journalingGoals: [],
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
          tags: ["work"],
        }),
      }),
    }),
  });

  const result = await createGoalSuggestions({
    userId: "user-1",
    journalId: "journal-1",
  });

  // Dedup would leave nothing here; the baseline bank keeps the screen useful.
  assert.equal(result.suggestions.length, 3);
  for (const suggestion of result.suggestions) {
    assert.equal(suggestion.iconSource, "automatic");
    assert.ok(suggestion.description, "top-ups carry a description");
  }
});
