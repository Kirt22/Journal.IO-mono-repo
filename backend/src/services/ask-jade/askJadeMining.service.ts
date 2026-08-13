import { z } from "zod";
import { jadeSessionModel } from "../../schema/jadeSession.schema";
import { jadeMessageModel } from "../../schema/jadeMessage.schema";
import { canUseOpenAiForUser, requestStructuredOpenAi } from "../../helpers/openai.helpers";
import { AI_EXTRACTION_BALANCE_GUIDANCE } from "../../helpers/aiReflectionBalance.helpers";
import { toThemeId } from "../../helpers/patternGraph.helpers";
import {
  toPatternObservation,
  upsertPatternObservations,
  type PatternObservation,
} from "../mindmap/patternGraph.service";
import { ASK_JADE_MODEL } from "./askJadeContext.service";

/**
 * Feeding Ask Jade conversations back into the pattern graph.
 *
 * The graph is otherwise blind to anything a person only ever says out loud —
 * "I watch shows while eating" is exactly the kind of detail that surfaces in
 * conversation rather than in a written entry, and it is often the piece that
 * explains two patterns the graph already holds.
 *
 * Two guards make this safe rather than a feedback loop:
 *   1. Only the USER's messages are mined. Mining Jade's own replies would let
 *      the graph confirm its own conclusions.
 *   2. Chat-derived confidence is discounted (CHAT_CONFIDENCE_FACTOR, applied
 *      in toPatternObservation), so a passing remark never outranks something
 *      the person actually sat down and wrote.
 */

/** Mine after roughly this many new turns (≈4 exchanges). */
const MINE_EVERY = () => {
  const raw = Number(process.env.JADE_MINE_EVERY);
  return Number.isFinite(raw) && raw >= 2 ? Math.floor(raw) : 8;
};

/** A conversation idle this long is treated as finished. */
const MINE_IDLE_MINUTES = () => {
  const raw = Number(process.env.JADE_MINE_IDLE_MINUTES);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 30;
};

const MINED_THEMES_MAX = 12;
const MINE_MESSAGE_LIMIT = 40;

const minedThemeSchema = z.object({
  label: z.string().trim().min(1).max(64),
  rationale: z.string().trim().min(1).max(220),
  evidenceQuote: z.string().trim().max(180),
  confidence: z.number().min(0).max(1),
});

const jadeMiningSchema = z.object({
  themes: z.array(minedThemeSchema).max(4),
});

const jadeMiningJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    themes: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string", minLength: 1, maxLength: 64 },
          rationale: { type: "string", minLength: 1, maxLength: 220 },
          evidenceQuote: { type: "string", maxLength: 180 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["label", "rationale", "evidenceQuote", "confidence"],
      },
    },
  },
  required: ["themes"],
} satisfies Record<string, unknown>;

const MINING_SYSTEM_PROMPT = [
  "You are reading only what one person said about themselves in a supportive conversation.",
  "Name up to four behavioural patterns their own words point to. A pattern is a behaviour tied to its trigger or to the feeling it regulates — 'eats while watching shows', 'goes quiet after a disagreement' — never a mood, a one-off event, or a plan.",
  AI_EXTRACTION_BALANCE_GUIDANCE,
  "Never name a condition, a diagnosis, or a personality trait, even if the person used that word themselves. Describe what they do, not what they think they are.",
  "evidenceQuote must be copied verbatim from their messages, or left empty. Never write a quote yourself.",
  "Only name a pattern the conversation genuinely supports. Returning no themes is the right answer for small talk.",
].join(" ");

/**
 * Extract patterns from the user's side of a conversation and fold them into
 * the graph. Best-effort throughout: this runs fire-and-forget after a reply
 * has already been delivered.
 */
export const mineJadeSessionIntoGraph = async ({
  userId,
  sessionId,
  force = false,
}: {
  userId: string;
  sessionId: string;
  force?: boolean;
}): Promise<void> => {
  try {
    if (!(await canUseOpenAiForUser(userId))) {
      return;
    }

    const session = await jadeSessionModel.findOne({ _id: sessionId, userId }).exec();
    if (!session) {
      return;
    }

    const unmined = session.messageCount - session.minedThroughSeq;
    if (!force && unmined < MINE_EVERY()) {
      return;
    }
    if (unmined <= 0) {
      return;
    }

    // The user's side only — never Jade's.
    const userTurns = await jadeMessageModel
      .find({
        sessionId: session._id,
        role: "user",
        seq: { $gt: session.minedThroughSeq },
      })
      .sort({ seq: 1 })
      .limit(MINE_MESSAGE_LIMIT)
      .select("text seq")
      .lean()
      .exec();

    if (!userTurns.length) {
      return;
    }

    const aiResponse = await requestStructuredOpenAi({
      feature: "ask jade pattern mining",
      schemaName: "ask_jade_pattern_mining",
      schema: jadeMiningJsonSchema,
      parser: jadeMiningSchema,
      model: ASK_JADE_MODEL(),
      maxOutputTokens: 600,
      reasoningEffort: "low",
      messages: [
        { role: "system", content: MINING_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            theirMessages: userTurns.map(turn => turn.text),
          }),
        },
      ],
    });

    if (!aiResponse || !aiResponse.themes.length) {
      await markMined(sessionId, userId, session.messageCount);
      return;
    }

    const observedAt = new Date();
    const observations = aiResponse.themes
      .map(theme =>
        toPatternObservation({
          label: theme.label,
          rationale: theme.rationale,
          evidenceQuote: theme.evidenceQuote,
          confidence: theme.confidence,
          regionId: null,
          sourceKind: "chat",
          journalId: null,
          sessionId,
          observedAt,
        })
      )
      .filter((observation): observation is PatternObservation => Boolean(observation));

    if (observations.length) {
      await upsertPatternObservations({ userId, observations });
    }

    // Persist what was mined so a full graph rebuild can replay chat-derived
    // patterns; they have no entry_insights row to replay from.
    const minedThemes = observations.map(observation => ({
      key: toThemeId(observation.label),
      label: observation.label,
      rationale: observation.rationale,
      evidenceQuote: observation.evidenceQuote,
      confidence: observation.confidence,
      seq: session.messageCount,
    }));

    await jadeSessionModel
      .updateOne(
        { _id: sessionId, userId },
        {
          $set: {
            minedAt: observedAt,
            minedThroughSeq: session.messageCount,
            minedThemes: [...session.minedThemes, ...minedThemes].slice(
              -MINED_THEMES_MAX
            ),
          },
        }
      )
      .exec();
  } catch (error) {
    console.error("Failed to mine Jade session into pattern graph:", error);
  }
};

const markMined = async (
  sessionId: string,
  userId: string,
  throughSeq: number
): Promise<void> => {
  await jadeSessionModel
    .updateOne(
      { _id: sessionId, userId },
      { $set: { minedAt: new Date(), minedThroughSeq: throughSeq } }
    )
    .exec();
};

/**
 * A conversation has no explicit end, so a user who simply walks away would
 * leave their last few turns unmined forever. This picks those up the next time
 * they open Ask Jade.
 */
export const sweepIdleJadeSessions = async (userId: string): Promise<void> => {
  try {
    const idleBefore = new Date(Date.now() - MINE_IDLE_MINUTES() * 60 * 1000);

    const stale = await jadeSessionModel
      .find({
        userId,
        lastMessageAt: { $lt: idleBefore },
        $expr: { $lt: ["$minedThroughSeq", "$messageCount"] },
      })
      .sort({ lastMessageAt: -1 })
      .limit(3)
      .select("_id")
      .lean()
      .exec();

    for (const row of stale) {
      await mineJadeSessionIntoGraph({
        userId,
        sessionId: String(row._id),
        force: true,
      });
    }
  } catch (error) {
    console.error("Failed to sweep idle Jade sessions:", error);
  }
};
