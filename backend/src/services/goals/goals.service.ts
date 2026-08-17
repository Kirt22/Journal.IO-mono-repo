import { z } from "zod";
import { AI_ACTION_BALANCE_GUIDANCE } from "../../helpers/aiReflectionBalance.helpers";
import { buildUserPersonalization } from "../../helpers/userPersonalization.helpers";
import {
  requestEmbedding,
  requestStructuredOpenAi,
} from "../../helpers/openai.helpers";
import {
  filterNovelGoalSuggestions,
  type GoalIntent,
} from "../../helpers/goalSuggestions.helpers";
import {
  assessGoalSignal,
  buildEntryBaselineGoals,
} from "../../helpers/generalGoalSuggestions.helpers";
import { buildUserReflectionMemory } from "../mindmap/entryInsight.service";
import { hasActivePremiumEntitlement } from "../../helpers/premiumEntitlement.helpers";
import { randomUUID } from "crypto";
import { journalModel } from "../../schema/journal.schema";
import { userModel, type IStructuredGoal } from "../../schema/user.schema";
import {
  DEFAULT_GOAL_ICON,
  GOAL_ICON_KEYS,
  normalizeGoalIcon,
  resolveUniqueGoalIcon,
  type GoalIconKey,
} from "../../helpers/goalIcons.helpers";
import {
  GOAL_FREQUENCIES,
  getServerFallbackDateKey,
  isGoalDoneForPeriod,
  isGoalFrequency,
  isValidLocalDateKey,
} from "../../helpers/goalPeriod.helpers";
import type {
  CreateGoalInput,
  DeleteGoalInput,
  GetGoalsInput,
  GoalDraftInput,
  GoalRecord,
  GoalsListResponse,
  GoalSuggestionsInput,
  GoalSuggestionsResponse,
  SetGoalCompletionInput,
  SetGoalStatusInput,
  UpdateGoalInput,
} from "../../types/goals.types";

export class GoalSuggestionsPremiumRequiredError extends Error {
  constructor() {
    super("AI goal suggestions are available with Premium.");
    this.name = "GoalSuggestionsPremiumRequiredError";
  }
}

/**
 * Raised when a delete is attempted on a goal that is not archived.
 *
 * The UI only ever offers Delete from an archived goal's edit sheet, but
 * enforcing it here means a future UI slip can never hard-delete user data.
 */
export class GoalNotArchivedError extends Error {
  constructor() {
    super("Archive this goal before deleting it.");
    this.name = "GoalNotArchivedError";
  }
}

const REMINDER_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const goalSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(80),
        description: z.string().trim().min(1).max(180),
        // Both enums below MUST come from the same shared constants as the JSON
        // schema. If they drift, requestStructuredOpenAi's parser fails and the
        // helper returns null — losing *all* suggestions, not just the icon.
        icon: z.enum(GOAL_ICON_KEYS),
        frequency: z.enum(GOAL_FREQUENCIES),
      })
    )
    .min(1)
    .max(4),
});

const goalSuggestionsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        // `strict: true` on the Responses API requires every property to be
        // listed in `required`.
        required: ["title", "description", "icon", "frequency"],
        properties: {
          // The maxLengths must mirror the Zod parser above. Without them a
          // single over-long title fails validation and discards *every*
          // suggestion in the batch.
          title: { type: "string", maxLength: 80 },
          description: { type: "string", maxLength: 180 },
          icon: { type: "string", enum: [...GOAL_ICON_KEYS] },
          frequency: { type: "string", enum: [...GOAL_FREQUENCIES] },
        },
      },
    },
  },
} satisfies Record<string, unknown>;

const normalizeGoalTitle = (value: string) =>
  value.trim().replace(/\s+/g, " ").slice(0, 120);

const toDate = (value: Date | string | number | undefined): Date =>
  value instanceof Date ? value : new Date(value ?? Date.now());

const normalizeDescription = (value: string | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, 200);

  return trimmed || null;
};

const resolveTodayKey = (today?: string) =>
  isValidLocalDateKey(today) ? today : getServerFallbackDateKey();

const toGoalRecord = (goal: IStructuredGoal, todayKey: string): GoalRecord => ({
  id: goal.id,
  title: goal.title,
  description: goal.description ?? null,
  icon: normalizeGoalIcon(goal.icon, goal.title),
  iconSource: goal.iconSource === "fixed" ? "fixed" : "automatic",
  frequency: isGoalFrequency(goal.frequency) ? goal.frequency : "as_needed",
  // Legacy statuses are drained by the schema's pre("validate") hook, but a
  // read that never saves can still see one, so narrow defensively here too.
  status: goal.status === "archived" || goal.status === "dismissed"
    ? "archived"
    : "active",
  reminderEnabled: goal.reminderEnabled === true,
  reminderTime: goal.reminderTime ?? null,
  lastCompletedLocalDate: goal.lastCompletedLocalDate ?? null,
  isCompletedForPeriod: isGoalDoneForPeriod(
    {
      frequency: isGoalFrequency(goal.frequency) ? goal.frequency : "as_needed",
      lastCompletedLocalDate: goal.lastCompletedLocalDate ?? null,
    },
    todayKey
  ),
  createdAt: toDate(goal.createdAt).toISOString(),
  updatedAt: toDate(goal.updatedAt).toISOString(),
});

const sortGoalsNewestFirst = (goals: IStructuredGoal[]): IStructuredGoal[] =>
  [...goals].sort(
    (a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()
  );

const getUsedGoalIcons = (
  goals: IStructuredGoal[],
  excludedGoalId?: string
) =>
  new Set<GoalIconKey>(
    goals
      .filter((goal) => goal.id !== excludedGoalId)
      .map((goal) => normalizeGoalIcon(goal.icon, goal.title))
  );

/**
 * Brings a user's goals up to the current shape, in one place.
 *
 * Two jobs:
 *  1. The original lazy migration — earlier releases stored goals only as plain
 *     `journalingGoals` strings, and `onboarding.service.ts` still writes that
 *     field, so this path stays live.
 *  2. Per-goal back-fill of the fields added for recurrence, icons and reminders,
 *     plus draining the legacy `completed` / `dismissed` statuses.
 *
 * `completed -> active + as_needed + date marker` is lossless: `as_needed` only
 * checks `lastCompletedLocalDate` for presence, never its value.
 *
 * A missing frequency becomes `as_needed`, deliberately NOT `daily` — guessing
 * `daily` would resurrect every pre-existing goal every morning.
 *
 * Calls `markModified("goals")` itself so no caller can forget it.
 * Returns true when the document was mutated and needs saving.
 */
const normalizeUserGoals = (user: {
  goals?: IStructuredGoal[];
  journalingGoals?: string[];
  markModified?: (path: string) => void;
}): boolean => {
  let didChange = false;

  if ((user.goals?.length ?? 0) === 0) {
    const legacyTitles = getUniqueGoals(user.journalingGoals || []);

    if (legacyTitles.length > 0) {
      const base = Date.now();
      const legacyUsedIcons = new Set<GoalIconKey>();

      // Preserve legacy order (oldest first) so the most recently added legacy
      // goal still sorts as the newest structured goal.
      user.goals = legacyTitles.map((title, index) => {
        const timestamp = new Date(base + index);
        const icon = resolveUniqueGoalIcon(title, legacyUsedIcons);
        legacyUsedIcons.add(icon);

        return {
          id: randomUUID(),
          title,
          description: null,
          icon,
          iconSource: "automatic",
          frequency: "as_needed",
          status: "active",
          reminderEnabled: false,
          reminderTime: null,
          lastCompletedLocalDate: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        } as IStructuredGoal;
      });

      didChange = true;
    }
  }

  const usedIcons = new Set<GoalIconKey>();

  // Reserve every explicit choice before assigning automatic icons. Without
  // this pass, an automatic goal earlier in the array could take an icon that a
  // later fixed goal already owns.
  for (const goal of user.goals || []) {
    if (!goal) {
      continue;
    }

    const storedIcon = normalizeGoalIcon(goal.icon, goal.title);
    const inferredSource =
      goal.iconSource === "automatic" || goal.iconSource === "fixed"
        ? goal.iconSource
        : goal.icon === undefined ||
            goal.icon === null ||
            goal.icon === "" ||
            storedIcon === DEFAULT_GOAL_ICON
          ? "automatic"
          : "fixed";

    if (inferredSource === "fixed") {
      usedIcons.add(storedIcon);
    }
  }

  for (const goal of user.goals || []) {
    if (!goal) {
      continue;
    }

    if (goal.status === "completed") {
      goal.status = "active";
      goal.frequency = "as_needed";

      if (!goal.lastCompletedLocalDate) {
        goal.lastCompletedLocalDate = toDate(goal.updatedAt)
          .toISOString()
          .slice(0, 10);
      }

      didChange = true;
    } else if (goal.status === "dismissed") {
      goal.status = "archived";
      didChange = true;
    }

    if (!isGoalFrequency(goal.frequency)) {
      goal.frequency = "as_needed";
      didChange = true;
    }

    const storedIcon = normalizeGoalIcon(goal.icon, goal.title);

    if (goal.iconSource !== "automatic" && goal.iconSource !== "fixed") {
      goal.iconSource =
        goal.icon === undefined ||
        goal.icon === null ||
        goal.icon === "" ||
        storedIcon === DEFAULT_GOAL_ICON
          ? "automatic"
          : "fixed";
      didChange = true;
    }

    if (goal.iconSource === "automatic") {
      const nextIcon = resolveUniqueGoalIcon(
        goal.title,
        usedIcons,
        storedIcon === DEFAULT_GOAL_ICON ? undefined : storedIcon
      );

      if (goal.icon !== nextIcon) {
        goal.icon = nextIcon;
        didChange = true;
      }
    } else if (goal.icon !== storedIcon) {
      goal.icon = storedIcon;
      didChange = true;
    }

    usedIcons.add(normalizeGoalIcon(goal.icon, goal.title));

    if (goal.description === undefined) {
      goal.description = null;
      didChange = true;
    }

    if (goal.reminderEnabled === undefined || goal.reminderEnabled === null) {
      goal.reminderEnabled = false;
      didChange = true;
    }

    if (goal.reminderTime === undefined) {
      goal.reminderTime = null;
      didChange = true;
    }

    if (goal.lastCompletedLocalDate === undefined) {
      goal.lastCompletedLocalDate = null;
      didChange = true;
    }
  }

  if (didChange) {
    user.markModified?.("goals");
  }

  return didChange;
};

/**
 * Applies a partial draft onto a goal. Returns true when anything changed, so
 * callers can skip a pointless save.
 */
const applyGoalDraft = (
  goal: IStructuredGoal,
  draft: GoalDraftInput,
  unavailableIcons: Iterable<GoalIconKey> = []
) => {
  let didChange = false;
  let titleChanged = false;

  if (draft.title !== undefined) {
    const nextTitle = normalizeGoalTitle(draft.title);

    if (!nextTitle) {
      throw new Error("Goal title is required.");
    }

    if (nextTitle !== goal.title) {
      goal.title = nextTitle;
      didChange = true;
      titleChanged = true;
    }
  }

  if (draft.description !== undefined) {
    const nextDescription = normalizeDescription(draft.description);

    if (nextDescription !== (goal.description ?? null)) {
      goal.description = nextDescription;
      didChange = true;
    }
  }

  const currentIconSource = goal.iconSource === "fixed" ? "fixed" : "automatic";
  const nextIconSource =
    draft.iconSource ||
    // Older clients that send an icon without the new source field intended an
    // explicit choice, so preserve that behavior.
    (draft.icon !== undefined ? "fixed" : currentIconSource);

  if (nextIconSource !== currentIconSource) {
    goal.iconSource = nextIconSource;
    didChange = true;
  }

  if (nextIconSource === "fixed" && draft.icon !== undefined) {
    const nextIcon = normalizeGoalIcon(draft.icon, goal.title);

    if (nextIcon !== goal.icon) {
      goal.icon = nextIcon;
      didChange = true;
    }
  } else if (
    nextIconSource === "automatic" &&
    (titleChanged || draft.iconSource === "automatic" || draft.icon !== undefined)
  ) {
    const nextIcon = resolveUniqueGoalIcon(
      goal.title,
      unavailableIcons,
      draft.iconSource === "automatic" ? draft.icon : undefined
    );

    if (nextIcon !== goal.icon) {
      goal.icon = nextIcon;
      didChange = true;
    }
  }

  if (draft.frequency !== undefined && isGoalFrequency(draft.frequency)) {
    if (draft.frequency !== goal.frequency) {
      goal.frequency = draft.frequency;
      didChange = true;
    }
  }

  if (draft.reminderEnabled !== undefined) {
    const nextEnabled = draft.reminderEnabled === true;

    if (nextEnabled !== (goal.reminderEnabled === true)) {
      goal.reminderEnabled = nextEnabled;
      didChange = true;
    }
  }

  if (draft.reminderTime !== undefined) {
    const nextTime =
      typeof draft.reminderTime === "string" &&
      REMINDER_TIME_PATTERN.test(draft.reminderTime)
        ? draft.reminderTime
        : null;

    if (nextTime !== (goal.reminderTime ?? null)) {
      goal.reminderTime = nextTime;
      didChange = true;
    }
  }

  return didChange;
};

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

type GoalSuggestionCandidate = Omit<
  GoalSuggestionsResponse["suggestions"][number],
  "iconSource"
>;

const createFallbackSuggestions = (
  content: string
): GoalSuggestionCandidate[] => {
  const comparable = content.toLowerCase();

  if (/\b(plan|tomorrow|next step|focus|routine|goal)\b/.test(comparable)) {
    return [
      {
        title: "Write tomorrow's first step",
        description:
          "Name one small action tonight so tomorrow starts with less friction.",
        icon: "plan",
        frequency: "daily",
      },
      {
        title: "Protect one focus block",
        description:
          "Give one part of the day a short distraction-light window.",
        icon: "focus",
        frequency: "daily",
      },
      {
        title: "Check in after progress",
        description:
          "Notice how your energy changes after one thing gets finished.",
        icon: "mood",
        frequency: "daily",
      },
    ];
  }

  if (
    /\b(stress|overwhelm|heavy|anxious|pressure|tired|drained)\b/.test(
      comparable
    )
  ) {
    return [
      {
        title: "Notice one pressure point",
        description:
          "Pause once tomorrow and name what feels heaviest without trying to solve all of it.",
        icon: "anxiety",
        frequency: "daily",
      },
      {
        title: "Add one softer reset",
        description:
          "Choose one short break, walk, stretch, or quiet moment that helps your system settle.",
        icon: "calm",
        frequency: "daily",
      },
      {
        title: "Close the day in one sentence",
        description:
          "End tomorrow with one line about what helped you feel a little steadier.",
        icon: "journal",
        frequency: "daily",
      },
    ];
  }

  return [
    {
      title: "Write one honest line",
      description:
        "Keep showing up with one clear sentence about how the day actually felt.",
      icon: "journal",
      frequency: "daily",
    },
    {
      title: "Name one thing to carry forward",
      description:
        "Choose one useful thought, habit, or moment you want to keep noticing.",
      icon: "gratitude",
      frequency: "daily",
    },
    {
      title: "Notice a repeating theme",
      description:
        "Watch for one pattern that shows up again in your writing this week.",
      icon: "mood",
      frequency: "weekly",
    },
  ];
};

const getGoals = async (input: GetGoalsInput): Promise<GoalsListResponse> => {
  const user = await userModel.findById(input.userId).exec();

  if (!user) {
    return { goals: [] };
  }

  const todayKey = resolveTodayKey(input.today);

  if (normalizeUserGoals(user)) {
    await user.save();
  }

  return {
    goals: sortGoalsNewestFirst(user.goals || []).map((goal) =>
      toGoalRecord(goal, todayKey)
    ),
  };
};

const createGoal = async (input: CreateGoalInput): Promise<GoalRecord> => {
  const user = await userModel.findById(input.userId).exec();

  if (!user) {
    throw new Error("User not found.");
  }

  const nextTitle = normalizeGoalTitle(input.title);

  if (!nextTitle) {
    throw new Error("Goal title is required.");
  }

  const todayKey = resolveTodayKey(input.today);

  normalizeUserGoals(user);

  const existing = (user.goals || []).find(
    (goal) =>
      goal.status === "active" &&
      goal.title.toLowerCase() === nextTitle.toLowerCase()
  );

  // A duplicate title MERGES the incoming payload instead of being ignored.
  // Returning the pre-existing goal untouched silently discarded whatever the
  // caller sent, which becomes a visible bug now that goals carry a reminder
  // time and a frequency: "I set a reminder and it didn't stick."
  if (existing) {
    applyGoalDraft(
      existing,
      { ...input, title: nextTitle },
      getUsedGoalIcons(user.goals || [], existing.id)
    );
    existing.updatedAt = new Date();
    user.markModified("goals");
    await user.save();

    return toGoalRecord(existing, todayKey);
  }

  const now = new Date();
  const iconSource =
    input.iconSource || (input.icon ? "fixed" : "automatic");
  const unavailableIcons = getUsedGoalIcons(user.goals || []);
  const goal: IStructuredGoal = {
    id: randomUUID(),
    title: nextTitle,
    description: normalizeDescription(input.description),
    // Falls back to the keyword matcher so a manually typed goal still gets a
    // sensible icon without an AI round trip.
    icon:
      iconSource === "fixed" && input.icon
        ? normalizeGoalIcon(input.icon, nextTitle)
        : resolveUniqueGoalIcon(nextTitle, unavailableIcons, input.icon),
    iconSource,
    frequency: isGoalFrequency(input.frequency) ? input.frequency : "as_needed",
    status: "active",
    reminderEnabled: input.reminderEnabled === true,
    reminderTime:
      typeof input.reminderTime === "string" &&
      REMINDER_TIME_PATTERN.test(input.reminderTime)
        ? input.reminderTime
        : null,
    lastCompletedLocalDate: null,
    createdAt: now,
    updatedAt: now,
  } as IStructuredGoal;

  user.goals = [...(user.goals || []), goal];
  user.markModified("goals");
  await user.save();

  return toGoalRecord(goal, todayKey);
};

const updateGoal = async (
  input: UpdateGoalInput
): Promise<GoalRecord | null> => {
  const user = await userModel.findById(input.userId).exec();

  if (!user) {
    return null;
  }

  const todayKey = resolveTodayKey(input.today);

  normalizeUserGoals(user);

  const goal = (user.goals || []).find((item) => item.id === input.goalId);

  if (!goal) {
    return null;
  }

  applyGoalDraft(
    goal,
    input,
    getUsedGoalIcons(user.goals || [], goal.id)
  );
  goal.updatedAt = new Date();
  user.markModified("goals");
  await user.save();

  return toGoalRecord(goal, todayKey);
};

/**
 * Records or clears a completion for the current period.
 *
 * One endpoint for both directions because both write the same single field;
 * splitting it would duplicate the validator, controller, service branch and the
 * client's notification cancel/re-arm path for no benefit.
 */
const setGoalCompletion = async (
  input: SetGoalCompletionInput
): Promise<GoalRecord | null> => {
  const user = await userModel.findById(input.userId).exec();

  if (!user) {
    return null;
  }

  const todayKey = resolveTodayKey(input.today ?? input.localDate);

  normalizeUserGoals(user);

  const goal = (user.goals || []).find((item) => item.id === input.goalId);

  if (!goal) {
    return null;
  }

  goal.lastCompletedLocalDate = input.completed
    ? resolveTodayKey(input.localDate)
    : null;
  goal.updatedAt = new Date();
  user.markModified("goals");
  await user.save();

  return toGoalRecord(goal, todayKey);
};

/** Archive / unarchive. Reminders are left intact — the scheduler filters on status. */
const setGoalStatus = async (
  input: SetGoalStatusInput
): Promise<GoalRecord | null> => {
  const user = await userModel.findById(input.userId).exec();

  if (!user) {
    return null;
  }

  const todayKey = resolveTodayKey(input.today);

  normalizeUserGoals(user);

  const goal = (user.goals || []).find((item) => item.id === input.goalId);

  if (!goal) {
    return null;
  }

  goal.status = input.status;
  goal.updatedAt = new Date();
  user.markModified("goals");
  await user.save();

  return toGoalRecord(goal, todayKey);
};

const deleteGoal = async (input: DeleteGoalInput): Promise<boolean> => {
  const user = await userModel.findById(input.userId).exec();

  if (!user) {
    return false;
  }

  normalizeUserGoals(user);

  const existingGoals = user.goals || [];
  const target = existingGoals.find((goal) => goal.id === input.goalId);

  if (!target) {
    return false;
  }

  if (target.status !== "archived") {
    throw new GoalNotArchivedError();
  }

  user.goals = existingGoals.filter((goal) => goal.id !== input.goalId);
  user.markModified("goals");
  await user.save();

  return true;
};

type SavedGoalSuggestionContext = {
  goals: Array<GoalIntent & { icon: GoalIconKey; status: "active" | "archived" }>;
  usedIcons: GoalIconKey[];
};

const buildSavedGoalSuggestionContext = (
  goals: IStructuredGoal[]
): SavedGoalSuggestionContext => ({
  goals: goals.map((goal) => ({
    title: goal.title,
    description: goal.description ?? null,
    icon: normalizeGoalIcon(goal.icon, goal.title),
    status:
      goal.status === "archived" || goal.status === "dismissed"
        ? "archived"
        : "active",
  })),
  usedIcons: goals.map((goal) => normalizeGoalIcon(goal.icon, goal.title)),
});

const getSavedGoalSuggestionContext = async (
  userId: string
): Promise<SavedGoalSuggestionContext> => {
  try {
    const user = await userModel
      .findById(userId)
      .select("goals journalingGoals")
      .exec();

    if (!user) {
      return { goals: [], usedIcons: [] };
    }

    if (normalizeUserGoals(user)) {
      await user.save();
    }

    return buildSavedGoalSuggestionContext(user.goals || []);
  } catch {
    // Suggestion generation already has a safe fallback. Novelty context is a
    // best-effort enhancement and must not break that primary flow.
    return { goals: [], usedIcons: [] };
  }
};

const prepareNovelGoalSuggestions = async <
  T extends GoalIntent & { icon: GoalIconKey }
>(
  candidates: T[],
  context: SavedGoalSuggestionContext,
  useEmbeddings = true,
  maxCandidates = 4
): Promise<Array<T & { iconSource: "automatic" }>> => {
  const novel = await filterNovelGoalSuggestions(candidates, context.goals, {
    useEmbeddings,
    maxCandidates,
  });
  const unavailable = new Set(context.usedIcons);

  return novel.map((candidate) => {
    const icon = resolveUniqueGoalIcon(
      candidate.title,
      unavailable,
      candidate.icon
    );
    unavailable.add(icon);

    return { ...candidate, icon, iconSource: "automatic" as const };
  });
};

/** Below this a goals screen looks broken, so the baseline bank fills the gap. */
const MIN_GOAL_SUGGESTIONS = 3;

/**
 * Novelty filtering can legitimately reject everything when a user's saved goals
 * already cover the entry. Rather than return an empty list, fill up from the
 * general baseline bank — the advice that holds regardless of what was written.
 */
const topUpGoalSuggestions = async <T extends GoalIntent & { icon: GoalIconKey }>(
  accepted: Array<T & { iconSource: "automatic" }>,
  bank: T[],
  context: SavedGoalSuggestionContext,
  limit = MIN_GOAL_SUGGESTIONS
): Promise<Array<T & { iconSource: "automatic" }>> => {
  const needed = limit - accepted.length;

  if (needed <= 0) {
    return accepted;
  }

  const extendedContext: SavedGoalSuggestionContext = {
    goals: [
      ...context.goals,
      ...accepted.map((goal) => ({
        title: goal.title,
        description: goal.description ?? null,
        icon: goal.icon,
        status: "active" as const,
      })),
    ],
    usedIcons: [...context.usedIcons, ...accepted.map((goal) => goal.icon)],
  };

  // Deterministic only: the bank is curated and already distinct, so paying for
  // embeddings here buys nothing and would delay a response the user is waiting on.
  const topUps = await prepareNovelGoalSuggestions(
    bank,
    extendedContext,
    false,
    bank.length
  );

  return [...accepted, ...topUps.slice(0, needed)];
};

const createGoalSuggestions = async (
  input: GoalSuggestionsInput
): Promise<GoalSuggestionsResponse> => {
  const user = await userModel
    .findById(input.userId)
    .select(
      "isPremium premiumPlanKey premiumExpiresAt premiumSource goals journalingGoals"
    )
    .exec();

  if (!user || !hasActivePremiumEntitlement(user)) {
    throw new GoalSuggestionsPremiumRequiredError();
  }

  if (normalizeUserGoals(user)) {
    await user.save();
  }
  const existingGoalContext = buildSavedGoalSuggestionContext(user.goals || []);

  const journal = await journalModel
    .findOne({ _id: input.journalId, userId: input.userId })
    .select("title content tags")
    .lean()
    .exec();

  if (!journal) {
    throw new Error("Entry not found.");
  }

  const entryContent = String(journal.content || "");
  const signal = assessGoalSignal(entryContent);
  const isGeneralEntry = signal.level === "general";
  // A general entry cannot ground a tailored goal, so the examples shown to the
  // model become the movement-first baseline instead of more journaling prompts.
  const fallback = isGeneralEntry
    ? buildEntryBaselineGoals(entryContent, MIN_GOAL_SUGGESTIONS)
    : createFallbackSuggestions(entryContent);

  // Best-effort long-term memory so goals can anchor in the user's real recurring
  // patterns, not just this one entry. Never blocks suggestion generation.
  let longTermMemory = "";
  try {
    const queryEmbedding = await requestEmbedding(
      String(journal.content || "")
        .trim()
        .slice(0, 1600)
    );
    longTermMemory = await buildUserReflectionMemory(input.userId, {
      queryEmbedding,
    });
  } catch (error) {
    console.error("Failed to build goal-suggestion memory:", error);
  }

  const personalization = await buildUserPersonalization(input.userId);

  const aiResponse = await requestStructuredOpenAi({
    feature: "journal entry goal suggestions",
    schemaName: "journal_entry_goal_suggestions",
    schema: goalSuggestionsJsonSchema,
    parser: goalSuggestionsSchema,
    maxOutputTokens: 320,
    messages: [
      {
        role: "system",
        content: [
          "You write Journal.IO goal suggestions. Suggest small supportive non-clinical goals from this saved entry. Keep them practical, optional, and emotionally safe. Never diagnose, shame, or overstate certainty.",
          "Use the entry and longTermMemory as evidence, while allowing a broadly useful contextual action such as a walk, a change of setting, or a small routine when it is a plausible experiment. Direct advice is welcome when the useful action is clear, but never assert a speculative hidden cause as fact.",
          "Do not repeat or paraphrase anything in existingGoals. A changed duration, time of day, meal, or trigger does not make the same core action a new goal. Return fewer goals when only a few are genuinely new, and never pad.",
          "Never return two goals that share the same core action. Merge them into one goal that keeps the specifics of both: a five-minute writing goal and a write-after-dinner goal become a single goal to write for five minutes after dinner.",
          isGeneralEntry
            ? "This entry is general and does not name a specific situation. Do not invent specifics or guess a hidden cause. Suggest broadly beneficial baseline actions a supportive coach recommends when nothing in particular stands out: movement first (a daily walk, a step target, a gym session), then sleep timing, daylight, food and water, and one point of human contact. Keep each goal concrete and countable."
            : "",
          // Without an explicit instruction models bias toward the first enum member.
          "Set `icon` to the single best-fitting key from the provided enum for what the goal is about, and use `target` when nothing fits. Set `frequency` to how often the goal should realistically recur: `daily` for a small everyday action, `weekly` for something done once a week, `as_needed` for a one-off.",
          personalization?.systemDirective,
          AI_ACTION_BALANCE_GUIDANCE,
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Create one to four genuinely new, practical goals from this saved entry. These are suggestions only and are not saved automatically.",
          userProfile: personalization?.promptProfile ?? null,
          title: journal.title,
          tags: Array.isArray(journal.tags) ? journal.tags : [],
          entrySignal: signal.level,
          entryTopics: signal.domains,
          entry: entryContent.trim().slice(0, 1400),
          longTermMemory: longTermMemory || "No prior entries yet.",
          existingGoals: existingGoalContext.goals,
          fallbackExamples: fallback,
        }),
      },
    ],
  });

  const candidates = aiResponse?.suggestions?.slice(0, 4) || fallback;
  const novelSuggestions = await prepareNovelGoalSuggestions(
    candidates,
    existingGoalContext,
    true
  );
  const suggestions = await topUpGoalSuggestions(
    novelSuggestions,
    buildEntryBaselineGoals(entryContent, Number.MAX_SAFE_INTEGER),
    existingGoalContext
  );

  return {
    journalId: input.journalId,
    suggestions,
  };
};

export {
  createGoal,
  createGoalSuggestions,
  deleteGoal,
  getGoals,
  getSavedGoalSuggestionContext,
  normalizeUserGoals,
  prepareNovelGoalSuggestions,
  topUpGoalSuggestions,
  setGoalCompletion,
  setGoalStatus,
  updateGoal,
};
