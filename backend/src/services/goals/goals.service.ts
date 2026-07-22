import { z } from "zod";
import { requestStructuredOpenAi } from "../../helpers/openai.helpers";
import { hasActivePremiumEntitlement } from "../../helpers/premiumEntitlement.helpers";
import { journalModel } from "../../schema/journal.schema";
import { userModel } from "../../schema/user.schema";
import type {
  CreateGoalInput,
  DeleteGoalInput,
  GoalRecord,
  GoalsListResponse,
  GoalSuggestionsInput,
  GoalSuggestionsResponse,
} from "../../types/goals.types";

export class GoalSuggestionsPremiumRequiredError extends Error {
  constructor() {
    super("AI goal suggestions are available with Premium.");
    this.name = "GoalSuggestionsPremiumRequiredError";
  }
}

export class GoalSuggestionsDisabledError extends Error {
  constructor() {
    super("AI goal suggestions are turned off for your account.");
    this.name = "GoalSuggestionsDisabledError";
  }
}

const goalSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(80),
        description: z.string().trim().min(1).max(180),
      })
    )
    .min(2)
    .max(4),
});

const goalSuggestionsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
        },
      },
    },
  },
} satisfies Record<string, unknown>;

const normalizeGoalTitle = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);

const toGoalId = (title: string) =>
  normalizeGoalTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const toGoalRecord = (title: string): GoalRecord => ({
  id: toGoalId(title),
  title: normalizeGoalTitle(title),
});

const getUniqueGoals = (values: string[]) => {
  const seen = new Set<string>();
  const nextGoals: string[] = [];

  for (const value of values) {
    const normalized = normalizeGoalTitle(value);

    if (!normalized) {
      continue;
    }

    const comparable = normalized.toLowerCase();

    if (seen.has(comparable)) {
      continue;
    }

    seen.add(comparable);
    nextGoals.push(normalized);
  }

  return nextGoals;
};

const createFallbackSuggestions = (content: string): GoalSuggestionsResponse["suggestions"] => {
  const comparable = content.toLowerCase();

  if (/\b(plan|tomorrow|next step|focus|routine|goal)\b/.test(comparable)) {
    return [
      {
        title: "Write tomorrow's first step",
        description: "Name one small action tonight so tomorrow starts with less friction.",
      },
      {
        title: "Protect one focus block",
        description: "Give one part of the day a short distraction-light window.",
      },
      {
        title: "Check in after progress",
        description: "Notice how your energy changes after one thing gets finished.",
      },
    ];
  }

  if (/\b(stress|overwhelm|heavy|anxious|pressure|tired|drained)\b/.test(comparable)) {
    return [
      {
        title: "Notice one pressure point",
        description: "Pause once tomorrow and name what feels heaviest without trying to solve all of it.",
      },
      {
        title: "Add one softer reset",
        description: "Choose one short break, walk, stretch, or quiet moment that helps your system settle.",
      },
      {
        title: "Close the day in one sentence",
        description: "End tomorrow with one line about what helped you feel a little steadier.",
      },
    ];
  }

  return [
    {
      title: "Write one honest line",
      description: "Keep showing up with one clear sentence about how the day actually felt.",
    },
    {
      title: "Name one thing to carry forward",
      description: "Choose one useful thought, habit, or moment you want to keep noticing.",
    },
    {
      title: "Notice a repeating theme",
      description: "Watch for one pattern that shows up again in your writing this week.",
    },
  ];
};

const getGoals = async (userId: string): Promise<GoalsListResponse> => {
  const user = await userModel.findById(userId).select("journalingGoals").lean().exec();

  return {
    goals: getUniqueGoals(user?.journalingGoals || []).map(toGoalRecord),
  };
};

const createGoal = async (input: CreateGoalInput): Promise<GoalRecord> => {
  const user = await userModel.findById(input.userId).exec();

  if (!user) {
    throw new Error("User not found.");
  }

  const nextTitle = normalizeGoalTitle(input.title);
  const existingGoals = getUniqueGoals(user.journalingGoals || []);

  if (
    existingGoals.some(goal => goal.toLowerCase() === nextTitle.toLowerCase())
  ) {
    return toGoalRecord(nextTitle);
  }

  user.journalingGoals = getUniqueGoals([...existingGoals, nextTitle]);
  await user.save();

  return toGoalRecord(nextTitle);
};

const deleteGoal = async (input: DeleteGoalInput): Promise<boolean> => {
  const user = await userModel.findById(input.userId).exec();

  if (!user) {
    return false;
  }

  const existingGoals = getUniqueGoals(user.journalingGoals || []);
  const filteredGoals = existingGoals.filter(goal => toGoalId(goal) !== input.goalId);

  if (filteredGoals.length === existingGoals.length) {
    return false;
  }

  user.journalingGoals = filteredGoals;
  await user.save();

  return true;
};

const createGoalSuggestions = async (
  input: GoalSuggestionsInput
): Promise<GoalSuggestionsResponse> => {
  const user = await userModel
    .findById(input.userId)
    .select(
      "isPremium premiumPlanKey premiumExpiresAt premiumSource onboardingContext.aiOptIn"
    )
    .lean()
    .exec();

  if (!user || !hasActivePremiumEntitlement(user)) {
    throw new GoalSuggestionsPremiumRequiredError();
  }

  if (user.onboardingContext?.aiOptIn === false) {
    throw new GoalSuggestionsDisabledError();
  }

  const journal = await journalModel
    .findOne({ _id: input.journalId, userId: input.userId })
    .select("title content tags")
    .lean()
    .exec();

  if (!journal) {
    throw new Error("Entry not found.");
  }

  const fallback = createFallbackSuggestions(journal.content || "");
  const aiResponse = await requestStructuredOpenAi({
    feature: "journal entry goal suggestions",
    schemaName: "journal_entry_goal_suggestions",
    schema: goalSuggestionsJsonSchema,
    parser: goalSuggestionsSchema,
    maxOutputTokens: 320,
    messages: [
      {
        role: "system",
        content:
          "You write Journal.IO goal suggestions. Suggest small supportive non-clinical goals from a single journal entry. Keep them practical, optional, and emotionally safe. Never diagnose, shame, or overstate certainty.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task:
            "Create 2-4 small goals from this saved entry. These are suggestions only and are not saved automatically.",
          title: journal.title,
          tags: Array.isArray(journal.tags) ? journal.tags : [],
          entry: String(journal.content || "").trim().slice(0, 1400),
          fallbackExamples: fallback,
        }),
      },
    ],
  });

  return {
    journalId: input.journalId,
    suggestions: aiResponse?.suggestions?.slice(0, 4) || fallback,
  };
};

export { createGoal, createGoalSuggestions, deleteGoal, getGoals };
