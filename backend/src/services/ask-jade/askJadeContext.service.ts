import { z } from "zod";
import { jadeMessageModel, type IJadeMessage } from "../../schema/jadeMessage.schema";
import { jadeSessionModel } from "../../schema/jadeSession.schema";
import {
  getOpenAiModel,
  requestEmbedding,
  requestStructuredOpenAi,
} from "../../helpers/openai.helpers";
import { buildReflectionVoicePrompt } from "../../helpers/reflectionVoice.helpers";
import { normalizeReflectionMapText } from "../../helpers/reflectionMap.helpers";
import { buildUserReflectionMemory } from "../mindmap/entryInsight.service";
import { loadPatternGraph } from "../mindmap/patternGraph.service";
import {
  PATTERN_PRECEDES_MIN_OBSERVATIONS,
  PATTERN_PROMPT_MIN_CONFIDENCE,
} from "../../helpers/patternGraph.helpers";

export const ASK_JADE_VERSION = "ask-jade-v1";

export const ASK_JADE_MODEL = () =>
  process.env.OPENAI_ASK_JADE_MODEL?.trim() || getOpenAiModel();

/**
 * Chat needs to feel responsive, and a 40-90 word reply does not need the depth
 * budget a full session analysis does. Overridable so it can be raised once the
 * reply quality has been felt on a real device.
 */
export const ASK_JADE_REASONING_EFFORT = ():
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max" => {
  const raw = process.env.OPENAI_ASK_JADE_REASONING_EFFORT?.trim();
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh" || raw === "max") {
    return raw;
  }
  return "low";
};

/** Live turns sent verbatim. Older turns are compacted into runningSummary. */
export const JADE_RECENT_TURNS = 12;
const SUMMARIZE_AFTER_UNSUMMARIZED_TURNS = 20;
const GRAPH_CONTEXT_MAX = 1400;

/**
 * Jade's voice: the shipped reflection-companion persona plus the deltas that
 * make it a chat partner rather than a written reflection.
 */
export const JADE_SYSTEM_PROMPT = buildReflectionVoicePrompt([
  "You are Jade. When the user addresses you by name, answer as Jade.",
  "You are a support partner for this person's own patterns, not a general-purpose assistant. If they ask for something unrelated to what they have written — code, trivia, recipes, news, general research — say warmly that you only work with their own reflections, and offer the nearest thing you can actually do for them.",
  "You have their pattern graph: the behaviours their entries keep showing and how those behaviours connect. Use it concretely — state the specific pattern and the link directly, and cite the evidence: the entry date, the stretch of days, or their own words. Say 'you did X on these days', not 'your entries suggest X'.",
  "You may name recognised psychological patterns and apply them to the user directly — avoidance, numbing, rumination, anxious or avoidant attachment behaviour, burnout or depressive markers — as a description of what their writing shows. Do not assert a formal disorder as established fact, even if the user names one first: if they say 'I think I have X', describe the behaviour their entries actually record rather than confirming the label.",
  "Default to a conversational turn: 40-90 words, plain spoken. When they ask you to explain something, to compare periods, or how to do something, take the room you need — up to about 180 words — rather than truncating a real answer to stay short.",
  "Put bullet or numbered content in the points field rather than embedding list markers in reply. Use points whenever the honest answer is a set of steps or a set of specific observations — do not wait to be asked for a list. Set pointStyle to none only when the reply is genuinely a single flowing thought.",
  "When they ask how to move on, what to change, or what to do next, put concrete sequenced steps in points, each one specific to their own entries and small enough to start today. Do not answer a 'how do I' question with a reflective question.",
  "Set visualization to the requestedVisualization value supplied by the server, or none. Never invent, estimate, or repeat numeric journal statistics; the server renders those from stored data.",
]);

export const jadeReplySchema = z.object({
  reply: z.string().trim().min(1).max(1400),
  points: z.array(z.string().trim().min(1).max(220)).max(6),
  pointStyle: z.enum(["none", "bulleted", "numbered"]),
  visualization: z.enum([
    "none",
    "summary_stats",
    "mood_trend_7d",
    "mood_trend_30d",
    "mood_distribution_30d",
    "mood_distribution_all_time",
    "activity_7d",
  ]),
  usedPatternKeys: z.array(z.string().trim().max(64)).max(4),
  suggestedFollowUp: z.string().trim().max(160),
});

export const jadeReplyJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string", minLength: 1, maxLength: 1400 },
    points: {
      type: "array",
      maxItems: 6,
      items: { type: "string", minLength: 1, maxLength: 220 },
    },
    pointStyle: {
      type: "string",
      enum: ["none", "bulleted", "numbered"],
    },
    visualization: {
      type: "string",
      enum: [
        "none",
        "summary_stats",
        "mood_trend_7d",
        "mood_trend_30d",
        "mood_distribution_30d",
        "mood_distribution_all_time",
        "activity_7d",
      ],
    },
    usedPatternKeys: {
      type: "array",
      maxItems: 4,
      items: { type: "string", maxLength: 64 },
    },
    suggestedFollowUp: { type: "string", maxLength: 160 },
  },
  required: [
    "reply",
    "points",
    "pointStyle",
    "visualization",
    "usedPatternKeys",
    "suggestedFollowUp",
  ],
} satisfies Record<string, unknown>;

export type JadeGraphContext = {
  patterns: {
    key: string;
    label: string;
    whyNoticed: string;
    timesSeen: number;
    theirWords: string;
  }[];
  connections: {
    from: string;
    to: string;
    relation: string;
    seenTogether: number;
    whatItLooksLike: string;
  }[];
  clusters: string[];
};

/**
 * The graph slice Jade reasons over for one message.
 *
 * A sibling of buildPatternGraphMemoryBlock with a larger budget and a
 * structured shape: Jade is not sharing a prompt with guided-reflection
 * scaffolding, and structure lets it cite a specific pattern rather than
 * paraphrasing a paragraph.
 */
export const buildJadeGraphContext = async (
  userId: string
): Promise<JadeGraphContext> => {
  const empty: JadeGraphContext = { patterns: [], connections: [], clusters: [] };

  try {
    const { nodes, edges } = await loadPatternGraph({
      userId,
      nodeLimit: 30,
      edgeLimit: 50,
    });

    const patterns = nodes.filter(node => node.kind === "pattern").slice(0, 8);
    const labelByKey = new Map(patterns.map(node => [node.key, node.label]));
    const selected = new Set(labelByKey.keys());

    const connections = edges
      .filter(edge => edge.confidence >= PATTERN_PROMPT_MIN_CONFIDENCE)
      .filter(edge => selected.has(edge.fromKey) && selected.has(edge.toKey))
      .filter(
        edge =>
          edge.type !== "precedes" ||
          edge.observations >= PATTERN_PRECEDES_MIN_OBSERVATIONS
      )
      .sort((left, right) => {
        const leftAi = left.source === "ai_inferred" ? 1 : 0;
        const rightAi = right.source === "ai_inferred" ? 1 : 0;
        return leftAi === rightAi ? right.strength - left.strength : rightAi - leftAi;
      })
      .slice(0, 6);

    return {
      patterns: patterns.map(node => ({
        key: node.key,
        label: node.label,
        whyNoticed: node.rationale,
        timesSeen: node.occurrences,
        theirWords: node.evidenceQuote,
      })),
      connections: connections.map(edge => ({
        from: labelByKey.get(edge.fromKey) || edge.fromKey,
        to: labelByKey.get(edge.toKey) || edge.toKey,
        relation: edge.type,
        seenTogether: edge.observations,
        whatItLooksLike: edge.rationale,
      })),
      clusters: nodes
        .filter(node => node.kind === "umbrella")
        .slice(0, 3)
        .map(node => node.label),
    };
  } catch (error) {
    console.error("Failed to build Jade graph context:", error);
    return empty;
  }
};

export type JadePromptContext = {
  knowledgeGraph: JadeGraphContext;
  longTermMemory: string;
  runningSummary: string;
  recentTurns: { role: "user" | "assistant"; text: string }[];
};

/**
 * Assemble everything Jade knows for one turn.
 *
 * Note what is NOT here: raw journal text. Every layer is distilled — pattern
 * labels, context summaries, and the user's own quoted sentences — which is the
 * same invariant the rest of the memory system holds.
 */
export const buildJadePromptContext = async ({
  userId,
  sessionId,
  runningSummary,
  latestUserText,
}: {
  userId: string;
  sessionId: string | null;
  runningSummary: string;
  latestUserText: string;
}): Promise<JadePromptContext> => {
  // Embedding the live message is what makes recall about *this* question
  // rather than just the most recent entries. Best-effort: null degrades to
  // recency + recurrence.
  const queryEmbedding = await requestEmbedding(latestUserText).catch(() => null);

  const [knowledgeGraph, longTermMemory, recentTurns] = await Promise.all([
    buildJadeGraphContext(userId),
    buildUserReflectionMemory(
      userId,
      queryEmbedding ? { queryEmbedding } : {}
    ).catch(() => ""),
    sessionId ? loadRecentTurns(sessionId) : Promise.resolve([]),
  ]);

  return {
    knowledgeGraph,
    longTermMemory: normalizeReflectionMapText(longTermMemory, 1600),
    runningSummary: normalizeReflectionMapText(runningSummary, 800),
    recentTurns,
  };
};

const loadRecentTurns = async (
  sessionId: string
): Promise<{ role: "user" | "assistant"; text: string }[]> => {
  const rows = await jadeMessageModel
    .find({ sessionId })
    .sort({ seq: -1 })
    .limit(JADE_RECENT_TURNS)
    .select("role text seq")
    .lean()
    .exec();

  return rows
    .reverse()
    .map(row => ({ role: row.role, text: row.text }));
};

/**
 * Serialize the turn payload. The Responses helper has no `assistant` role, so
 * prior turns are JSON-encoded inside a single `user` message — the same
 * workaround guided reflection already uses for its thread.
 */
export const buildJadeUserPayload = ({
  context,
  latestUserText,
  requestedVisualization = "none",
}: {
  context: JadePromptContext;
  latestUserText: string;
  requestedVisualization?: string;
}): string =>
  JSON.stringify({
    task: "Reply to the user's latest message as Jade.",
    knowledgeGraph: context.knowledgeGraph,
    longTermMemory: context.longTermMemory || "No prior entries yet.",
    earlierInThisConversation: context.runningSummary || "",
    recentTurns: context.recentTurns,
    latestUserMessage: latestUserText,
    requestedVisualization,
  });

const summarySchema = z.object({ summary: z.string().trim().max(800) });
const summaryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: { summary: { type: "string", maxLength: 800 } },
  required: ["summary"],
} satisfies Record<string, unknown>;

/**
 * Compact the turns that have fallen out of the live window so a long
 * conversation stays coherent without resending every message. Fire-and-forget
 * and fully best-effort — a failure just means the next turn tries again.
 */
export const maybeSummarizeJadeSession = async (
  sessionId: string
): Promise<void> => {
  try {
    const session = await jadeSessionModel.findById(sessionId).exec();
    if (!session) {
      return;
    }

    const unsummarized = session.messageCount - session.summarizedThroughSeq;
    if (unsummarized <= SUMMARIZE_AFTER_UNSUMMARIZED_TURNS) {
      return;
    }

    const olderTurns = await jadeMessageModel
      .find({ sessionId, seq: { $lte: session.messageCount - JADE_RECENT_TURNS } })
      .sort({ seq: 1 })
      .select("role text seq")
      .lean()
      .exec();

    if (!olderTurns.length) {
      return;
    }

    const response = await requestStructuredOpenAi({
      feature: "ask jade session summary",
      schemaName: "ask_jade_session_summary",
      schema: summaryJsonSchema,
      parser: summarySchema,
      model: ASK_JADE_MODEL(),
      maxOutputTokens: 400,
      reasoningEffort: "low",
      messages: [
        {
          role: "system",
          content:
            "You keep a compact running summary of an ongoing supportive conversation so it can continue coherently. Merge the existing summary with the earlier turns. Keep what the person is working through and anything they asked to be remembered; drop small talk. Never invent detail, and never record a formal diagnosis as fact. A few sentences at most.",
        },
        {
          role: "user",
          content: JSON.stringify({
            existingSummary: session.runningSummary || "",
            earlierTurns: olderTurns.map(turn => ({
              role: turn.role,
              text: turn.text,
            })),
          }),
        },
      ],
    });

    if (!response) {
      return;
    }

    session.runningSummary = normalizeReflectionMapText(response.summary, 800);
    session.summarizedThroughSeq = Math.max(
      0,
      session.messageCount - JADE_RECENT_TURNS
    );
    await session.save();
  } catch (error) {
    console.error("Failed to summarize Jade session:", error);
  }
};

export type LoadedJadeMessage = IJadeMessage;
