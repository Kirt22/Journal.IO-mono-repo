import mongoose from "mongoose";
import { jadeSessionModel, type IJadeSession } from "../../schema/jadeSession.schema";
import { jadeMessageModel, type IJadeMessage } from "../../schema/jadeMessage.schema";
import { ensureAiAnalysisEnabled } from "../../helpers/aiAccess.helpers";
import { requestStructuredOpenAiDetailed } from "../../helpers/openai.helpers";
import {
  buildProductPrivacyReply,
  isProductPrivacyQuestion,
} from "../../helpers/productPrivacy.helpers";
import {
  detectJournalSafetySignal,
  hasJournalSafetySignal,
} from "../../helpers/journalSafety.helpers";
import { normalizeReflectionMapText } from "../../helpers/reflectionMap.helpers";
import {
  ASK_JADE_MODEL,
  ASK_JADE_REASONING_EFFORT,
  ASK_JADE_VERSION,
  JADE_SYSTEM_PROMPT,
  buildJadePromptContext,
  buildJadeUserPayload,
  jadeReplyJsonSchema,
  jadeReplySchema,
  maybeSummarizeJadeSession,
} from "./askJadeContext.service";
import { mineJadeSessionIntoGraph, sweepIdleJadeSessions } from "./askJadeMining.service";
import type {
  JadeMessageResponse,
  JadeMessageBlock,
  JadeMessageStatus,
  JadeSendMessageResponse,
  JadeSessionListResponse,
  JadeSessionSummaryResponse,
  JadeSessionThreadResponse,
  JadeTurnLimits,
} from "../../types/askJade.types";
import {
  detectJadeVisualization,
  flattenJadeBlocks,
  isUnsupportedJadeVisualization,
  loadJadeVisualizationBlock,
} from "./askJadeRichReply.service";

const TITLE_MAX = 48;
const PREVIEW_MAX = 120;
const MESSAGE_MAX = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Per-user turn limits enforced in Mongo rather than with a rate-limit
 * middleware: the repo has no request-level limiting (the global limiter is
 * commented out), and counting the user's own messages needs no new collection
 * or state to keep consistent.
 */
const TURNS_PER_DAY = () => {
  const raw = Number(process.env.JADE_TURNS_PER_DAY);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 40;
};

const TURNS_PER_HOUR = () => {
  const raw = Number(process.env.JADE_TURNS_PER_HOUR);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 15;
};

export class InvalidJadeCursorError extends Error {
  constructor() {
    super("We couldn't load that page of your chats.");
    this.name = "InvalidJadeCursorError";
  }
}

export class JadeTurnLimitReachedError extends Error {
  resetAt: Date;

  constructor(resetAt: Date) {
    super("You've reached your limit with Jade for now.");
    this.name = "JadeTurnLimitReachedError";
    this.resetAt = resetAt;
  }
}

/**
 * Deterministic replies. Both exist so the transcript stays a real
 * conversation: an error toast would leave the user's message sitting alone
 * with no response, which reads worse than an honest line from Jade.
 */
const FALLBACK_REPLY =
  "I couldn't reach my thoughts just then. Give it another go in a moment — I'm still here.";

const SUPPORT_FIRST_REPLY =
  "I'm really glad you told me. What you're describing sounds heavy, and I don't want to hand you something light in return. I'm an AI, so I can't be the help you need right now — please reach out to your local emergency services or a crisis line and talk to a real person tonight. I'll be here whenever you want to come back.";

const toIso = (value: Date | null | undefined): string =>
  value ? new Date(value).toISOString() : new Date(0).toISOString();

const serializeMessage = (message: IJadeMessage): JadeMessageResponse => ({
  id: message._id.toString(),
  seq: message.seq,
  role: message.role,
  text: message.text,
  status: message.status,
  blocks: Array.isArray(message.blocks) ? message.blocks : [],
  createdAt: toIso(message.createdAt),
});

const serializeSession = (session: IJadeSession): JadeSessionSummaryResponse => ({
  id: session._id.toString(),
  title: session.title,
  lastMessagePreview: session.lastMessagePreview,
  messageCount: session.messageCount,
  lastMessageAt: toIso(session.lastMessageAt),
});

/**
 * Session titles are the first thing the user wrote, trimmed. Deterministic on
 * purpose: an AI-generated title would add a call, a cost, and a failure mode
 * to something a substring already does well.
 */
const buildSessionTitle = (text: string): string => {
  const normalized = normalizeReflectionMapText(text, TITLE_MAX + 1);
  return normalized.length > TITLE_MAX
    ? `${normalized.slice(0, TITLE_MAX - 1).trimEnd()}…`
    : normalized;
};

// ── Cursors ────────────────────────────────────────────────────────────────
// Keyset pagination in both directions, matching the journal list convention.

type SessionCursor = { lastMessageAt: string; id: string };

const encodeSessionCursor = (session: IJadeSession): string =>
  Buffer.from(
    JSON.stringify({
      lastMessageAt: toIso(session.lastMessageAt),
      id: session._id.toString(),
    } satisfies SessionCursor)
  ).toString("base64url");

const decodeSessionCursor = (raw: string): SessionCursor => {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      !parsed ||
      typeof parsed.lastMessageAt !== "string" ||
      typeof parsed.id !== "string" ||
      Number.isNaN(new Date(parsed.lastMessageAt).getTime())
    ) {
      throw new Error("malformed cursor");
    }
    return parsed as SessionCursor;
  } catch {
    throw new InvalidJadeCursorError();
  }
};

const encodeMessageCursor = (seq: number): string =>
  Buffer.from(JSON.stringify({ seq })).toString("base64url");

const decodeMessageCursor = (raw: string): number => {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!parsed || typeof parsed.seq !== "number" || !Number.isFinite(parsed.seq)) {
      throw new Error("malformed cursor");
    }
    return parsed.seq;
  } catch {
    throw new InvalidJadeCursorError();
  }
};

// ── Turn limits ────────────────────────────────────────────────────────────

const countUserTurnsSince = async (userId: string, since: Date): Promise<number> =>
  jadeMessageModel
    .countDocuments({ userId, role: "user", createdAt: { $gte: since } })
    .exec();

const readTurnLimits = async (userId: string): Promise<JadeTurnLimits> => {
  const now = Date.now();
  const turnsUsedToday = await countUserTurnsSince(userId, new Date(now - DAY_MS));
  const turnsPerDay = TURNS_PER_DAY();

  return {
    turnsUsedToday,
    turnsPerDay,
    resetAt:
      turnsUsedToday >= turnsPerDay ? new Date(now + DAY_MS).toISOString() : null,
  };
};

const assertWithinTurnLimits = async (userId: string): Promise<void> => {
  const now = Date.now();

  const [usedToday, usedThisHour] = await Promise.all([
    countUserTurnsSince(userId, new Date(now - DAY_MS)),
    countUserTurnsSince(userId, new Date(now - HOUR_MS)),
  ]);

  if (usedToday >= TURNS_PER_DAY()) {
    throw new JadeTurnLimitReachedError(new Date(now + DAY_MS));
  }
  if (usedThisHour >= TURNS_PER_HOUR()) {
    throw new JadeTurnLimitReachedError(new Date(now + HOUR_MS));
  }
};

// ── Reads ──────────────────────────────────────────────────────────────────

export const listJadeSessions = async ({
  userId,
  limit = 20,
  cursor,
}: {
  userId: string;
  limit?: number;
  cursor?: string | undefined;
}): Promise<JadeSessionListResponse> => {
  await ensureAiAnalysisEnabled(userId);

  const filter: Record<string, unknown> = { userId };

  if (cursor) {
    const decoded = decodeSessionCursor(cursor);
    const cursorDate = new Date(decoded.lastMessageAt);
    filter.$or = [
      { lastMessageAt: { $lt: cursorDate } },
      { lastMessageAt: cursorDate, _id: { $lt: decoded.id } },
    ];
  }

  const rows = await jadeSessionModel
    .find(filter)
    .sort({ lastMessageAt: -1, _id: -1 })
    // One extra row is how hasMore is known without a second count query.
    .limit(limit + 1)
    .exec();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  // A conversation the user walked away from still has value to the graph.
  void sweepIdleJadeSessions(userId).catch(() => undefined);

  return {
    sessions: page.map(serializeSession),
    pagination: {
      nextCursor: hasMore && last ? encodeSessionCursor(last) : null,
      hasMore,
    },
  };
};

export const getJadeSession = async ({
  userId,
  sessionId,
  limit = 30,
  cursor,
}: {
  userId: string;
  sessionId: string;
  limit?: number;
  cursor?: string | undefined;
}): Promise<JadeSessionThreadResponse | null> => {
  await ensureAiAnalysisEnabled(userId);

  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return null;
  }

  const session = await jadeSessionModel.findOne({ _id: sessionId, userId }).exec();
  if (!session) {
    return null;
  }

  // Reverse keyset: the newest turns load first and the cursor walks backwards
  // into history as the user scrolls up.
  const filter: Record<string, unknown> = { sessionId: session._id };
  if (cursor) {
    filter.seq = { $lt: decodeMessageCursor(cursor) };
  }

  const rows = await jadeMessageModel
    .find(filter)
    .sort({ seq: -1 })
    .limit(limit + 1)
    .exec();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const oldest = page[page.length - 1];

  return {
    session: serializeSession(session),
    messages: page.reverse().map(serializeMessage),
    pagination: {
      nextCursor: hasMore && oldest ? encodeMessageCursor(oldest.seq) : null,
      hasMore,
    },
  };
};

export const deleteJadeSession = async ({
  userId,
  sessionId,
}: {
  userId: string;
  sessionId: string;
}): Promise<boolean> => {
  await ensureAiAnalysisEnabled(userId);

  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return false;
  }

  const session = await jadeSessionModel
    .findOneAndDelete({ _id: sessionId, userId })
    .exec();

  if (!session) {
    return false;
  }

  await jadeMessageModel.deleteMany({ sessionId: session._id }).exec();
  return true;
};

// ── Writes ─────────────────────────────────────────────────────────────────

/**
 * Allocate the next sequence number atomically. Reading messageCount and then
 * writing seq+1 would let two concurrent sends collide on the unique
 * {sessionId, seq} index.
 */
const allocateSeq = async (
  sessionId: mongoose.Types.ObjectId,
  userId: string
): Promise<number | null> => {
  const updated = await jadeSessionModel
    .findOneAndUpdate(
      { _id: sessionId, userId },
      { $inc: { messageCount: 1 } },
      { new: true }
    )
    .exec();

  return updated ? updated.messageCount : null;
};

const appendMessage = async ({
  userId,
  sessionId,
  seq,
  role,
  text,
  status,
  aiModel,
  blocks = [],
}: {
  userId: string;
  sessionId: mongoose.Types.ObjectId;
  seq: number;
  role: "user" | "assistant";
  text: string;
  status: JadeMessageStatus;
  aiModel: string | null;
  blocks?: JadeMessageBlock[];
}): Promise<IJadeMessage> =>
  jadeMessageModel.create({
    userId,
    sessionId,
    seq,
    role,
    text,
    status,
    blocks,
    aiModel,
    tokensEstimated: Math.ceil(text.length / 4),
  });

export const sendJadeMessage = async ({
  userId,
  sessionId,
  text,
  timeZone,
}: {
  userId: string;
  sessionId?: string | undefined;
  text: string;
  timeZone?: string | undefined;
}): Promise<JadeSendMessageResponse> => {
  await ensureAiAnalysisEnabled(userId);
  await assertWithinTurnLimits(userId);

  const userText = normalizeReflectionMapText(text, MESSAGE_MAX);
  const now = new Date();

  // Resolve or open the conversation. A missing/foreign sessionId silently
  // starts a new chat rather than failing the send — the user's message is the
  // thing worth protecting here.
  let session: IJadeSession | null = null;
  if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
    session = await jadeSessionModel.findOne({ _id: sessionId, userId }).exec();
  }

  if (!session) {
    session = await jadeSessionModel.create({
      userId,
      title: buildSessionTitle(userText),
      messageCount: 0,
      lastMessageAt: now,
      lastMessagePreview: normalizeReflectionMapText(userText, PREVIEW_MAX),
      runningSummary: "",
      summarizedThroughSeq: 0,
      status: "active",
      minedAt: null,
      minedThroughSeq: 0,
      minedThemes: [],
      aiModel: null,
      version: ASK_JADE_VERSION,
    });
    void sweepIdleJadeSessions(userId).catch(() => undefined);
  }

  const userSeq = await allocateSeq(session._id, userId);
  if (userSeq === null) {
    throw new Error("Failed to allocate a message sequence.");
  }

  const userMessage = await appendMessage({
    userId,
    sessionId: session._id,
    seq: userSeq,
    role: "user",
    text: userText,
    status: "ok",
    aiModel: null,
    blocks: [],
  });

  // Safety comes before the model, not after it: when someone writes something
  // this heavy, the response must be the deterministic support-first one and no
  // request should be made at all.
  const safetySignal = detectJournalSafetySignal(userText);
  let replyText = SUPPORT_FIRST_REPLY;
  let replyStatus: JadeMessageStatus = "support_first";
  let replyModel: string | null = null;
  let replyBlocks: JadeMessageBlock[] = [
    { type: "text", text: SUPPORT_FIRST_REPLY },
  ];

  if (!hasJournalSafetySignal(safetySignal)) {
    if (isProductPrivacyQuestion(userText)) {
      replyText = buildProductPrivacyReply();
      replyStatus = "product_fact";
      replyBlocks = [{ type: "text", text: replyText }];
    } else if (isUnsupportedJadeVisualization(userText)) {
      replyText =
        "I can graph your logged moods and writing activity, but emotion and theme labels are not normalized enough yet for a trustworthy chart. Try asking for a 7-day or 30-day mood trend instead.";
      replyStatus = "product_fact";
      replyBlocks = [{ type: "text", text: replyText }];
    } else {
      const visualization = detectJadeVisualization(userText);
      const [context, visualizationBlock] = await Promise.all([
        buildJadePromptContext({
          userId,
          sessionId: session._id.toString(),
          runningSummary: session.runningSummary,
          latestUserText: userText,
        }),
        visualization
          ? loadJadeVisualizationBlock({
              userId,
              visualization,
              ...(timeZone ? { timeZone } : {}),
            })
          : Promise.resolve(null),
      ]);

      const aiResult = await requestStructuredOpenAiDetailed({
        feature: "ask jade reply",
        schemaName: "ask_jade_reply",
        schema: jadeReplyJsonSchema,
        parser: jadeReplySchema,
        model: ASK_JADE_MODEL(),
        // A 1400-char reply plus up to 6 step/evidence points sits near 800
        // tokens of visible output, and reasoning tokens are billed against
        // this same ceiling. A truncated reply parses as null and reaches the
        // user as a generic fallback, so keep real headroom above the worst
        // case rather than trimming this to the typical one.
        maxOutputTokens: 3000,
        reasoningEffort: ASK_JADE_REASONING_EFFORT(),
        messages: [
          { role: "system", content: JADE_SYSTEM_PROMPT },
          {
            role: "user",
            content: buildJadeUserPayload({
              context,
              latestUserText: userText,
              requestedVisualization: visualization || "none",
            }),
          },
        ],
      });

      if (aiResult.data) {
        const prose = normalizeReflectionMapText(aiResult.data.reply, 1400);
        replyBlocks = [{ type: "text", text: prose }];
        if (
          aiResult.data.pointStyle !== "none" &&
          aiResult.data.points.length > 0
        ) {
          replyBlocks.push({
            type: "list",
            style: aiResult.data.pointStyle,
            items: aiResult.data.points.map(point =>
              normalizeReflectionMapText(point, 220)
            ),
          });
        }
        if (visualizationBlock) replyBlocks.push(visualizationBlock);
        replyText = flattenJadeBlocks(replyBlocks);
        replyStatus = "ok";
        replyModel = ASK_JADE_MODEL();
      } else if (
        visualizationBlock &&
        "dataState" in visualizationBlock &&
        visualizationBlock.dataState !== "unavailable"
      ) {
        replyBlocks = [
          {
            type: "text",
            text:
              visualizationBlock.dataState === "empty"
                ? "I don't have enough check-ins to draw that clearly yet, but this view will fill in as you keep tracking."
                : "Here's the view built from the data you've logged in Journal.IO.",
          },
          visualizationBlock,
        ];
        replyText = flattenJadeBlocks(replyBlocks);
        replyStatus = "ok";
      } else {
        replyText = FALLBACK_REPLY;
        replyStatus = "fallback";
        replyBlocks = [{ type: "text", text: FALLBACK_REPLY }];
      }
    }
  }

  const replySeq = await allocateSeq(session._id, userId);
  if (replySeq === null) {
    throw new Error("Failed to allocate a reply sequence.");
  }

  const replyMessage = await appendMessage({
    userId,
    sessionId: session._id,
    seq: replySeq,
    role: "assistant",
    text: replyText,
    status: replyStatus,
    aiModel: replyModel,
    blocks: replyBlocks,
  });

  const refreshed = await jadeSessionModel
    .findOneAndUpdate(
      { _id: session._id, userId },
      {
        $set: {
          lastMessageAt: new Date(),
          lastMessagePreview: normalizeReflectionMapText(replyText, PREVIEW_MAX),
          aiModel: replyModel,
          ...(session.title ? {} : { title: buildSessionTitle(userText) }),
        },
      },
      { new: true }
    )
    .exec();

  const sessionIdString = session._id.toString();

  // Both are best-effort follow-ups; neither may delay or fail the reply.
  void maybeSummarizeJadeSession(sessionIdString).catch(() => undefined);
  void mineJadeSessionIntoGraph({ userId, sessionId: sessionIdString }).catch(
    () => undefined
  );

  return {
    sessionId: sessionIdString,
    title: refreshed?.title || session.title,
    userMessage: serializeMessage(userMessage),
    reply: serializeMessage(replyMessage),
    limits: await readTurnLimits(userId),
  };
};

export { encodeSessionCursor, decodeSessionCursor, encodeMessageCursor, decodeMessageCursor, buildSessionTitle };
