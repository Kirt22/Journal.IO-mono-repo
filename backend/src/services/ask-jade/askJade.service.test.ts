import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import mongoose from "mongoose";
import { jadeMessageModel } from "../../schema/jadeMessage.schema";
import { jadeSessionModel } from "../../schema/jadeSession.schema";
import { userModel } from "../../schema/user.schema";
import { PremiumFeatureRequiredError } from "../../helpers/aiAccess.helpers";
import { JADE_SYSTEM_PROMPT, buildJadeUserPayload } from "./askJadeContext.service";
import {
  InvalidJadeCursorError,
  JadeTurnLimitReachedError,
  buildSessionTitle,
  decodeMessageCursor,
  decodeSessionCursor,
  encodeMessageCursor,
  encodeSessionCursor,
  listJadeSessions,
  sendJadeMessage,
} from "./askJade.service";

type AnyChain = Record<string, unknown>;

const sessionTarget = jadeSessionModel as unknown as AnyChain;
const messageTarget = jadeMessageModel as unknown as AnyChain;
const userTarget = userModel as unknown as AnyChain;

const originalUserFindById = userTarget.findById;

/**
 * Restore to inert stubs rather than the real Mongoose methods. `sendJadeMessage`
 * kicks off fire-and-forget summarize/mine/sweep work that can land after a test
 * has finished, and there is no database here — restoring the real methods would
 * let that stray work hit an unconnected driver.
 */
const emptyListChain = () => ({
  sort: () => ({
    limit: () => ({
      select: () => ({ lean: () => ({ exec: async () => [] as unknown[] }) }),
      exec: async () => [] as unknown[],
    }),
  }),
});

const installInertModelStubs = () => {
  Object.assign(sessionTarget, {
    find: emptyListChain,
    findOne: () => ({ exec: async () => null }),
    findById: () => ({ exec: async () => null }),
    create: async (doc: Record<string, unknown>) => doc,
    findOneAndUpdate: () => ({ exec: async () => null }),
    updateOne: () => ({ exec: async () => ({ acknowledged: true }) }),
  });
  Object.assign(messageTarget, {
    find: emptyListChain,
    create: async (doc: Record<string, unknown>) => doc,
    countDocuments: () => ({ exec: async () => 0 }),
    deleteMany: () => ({ exec: async () => ({ deletedCount: 0 }) }),
  });
};

installInertModelStubs();

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalFieldEncryptionMode = process.env.FIELD_ENCRYPTION_MODE;

afterEach(() => {
  installInertModelStubs();
  userTarget.findById = originalUserFindById;

  globalThis.fetch = originalFetch;
  if (typeof originalApiKey === "string") {
    process.env.OPENAI_API_KEY = originalApiKey;
  } else {
    delete process.env.OPENAI_API_KEY;
  }
  delete process.env.JADE_TURNS_PER_DAY;
  if (typeof originalFieldEncryptionMode === "string") {
    process.env.FIELD_ENCRYPTION_MODE = originalFieldEncryptionMode;
  } else {
    delete process.env.FIELD_ENCRYPTION_MODE;
  }
});

const stubUserPremium = (isPremium: boolean) => {
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () =>
          isPremium
            ? {
                isPremium: true,
                premiumPlanKey: "yearly",
                premiumExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
                premiumSource: "revenuecat_verified",
              }
            : { isPremium: false },
      }),
    }),
  });
};

const makeSessionDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  userId: new mongoose.Types.ObjectId(),
  title: "Why do I keep doing this",
  messageCount: 0,
  lastMessageAt: new Date("2026-08-10T00:00:00.000Z"),
  lastMessagePreview: "",
  runningSummary: "",
  summarizedThroughSeq: 0,
  status: "active",
  minedAt: null,
  minedThroughSeq: 0,
  minedThemes: [] as unknown[],
  aiModel: null,
  version: "ask-jade-v1",
  ...overrides,
});

/** Wires up just enough of the write path for one full send to complete. */
const stubSendPath = ({
  session,
  onMessageCreate,
}: {
  session: ReturnType<typeof makeSessionDoc>;
  onMessageCreate?: (doc: Record<string, unknown>) => void;
}) => {
  sessionTarget.findOne = () => ({ exec: async () => session });
  sessionTarget.create = async () => session;
  // The idle sweep fires alongside a send; give it nothing to find.
  sessionTarget.find = emptyListChain;
  sessionTarget.findOneAndUpdate = () => ({
    exec: async () => {
      session.messageCount += 1;
      return session;
    },
  });
  sessionTarget.updateOne = () => ({ exec: async () => ({ acknowledged: true }) });
  sessionTarget.findById = () => ({ exec: async () => session });

  messageTarget.countDocuments = () => ({ exec: async () => 0 });
  messageTarget.find = () => ({
    sort: () => ({
      limit: () => ({
        select: () => ({ lean: () => ({ exec: async () => [] }) }),
      }),
    }),
  });
  messageTarget.create = async (doc: Record<string, unknown>) => {
    onMessageCreate?.(doc);
    return {
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
      ...doc,
    };
  };
};

test("a non-premium user cannot reach Jade at all", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  stubUserPremium(false);

  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  await assert.rejects(
    () => sendJadeMessage({ userId: "free-user", text: "hello" }),
    PremiumFeatureRequiredError
  );
  assert.equal(fetchCalled, false);

  // The session list is gated too, so the client's locked state is simply
  // "every Ask Jade call 403s" rather than a special case.
  await assert.rejects(
    () => listJadeSessions({ userId: "free-user" }),
    PremiumFeatureRequiredError
  );
});

test("sending is refused once the daily turn limit is reached", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.JADE_TURNS_PER_DAY = "3";
  stubUserPremium(true);

  messageTarget.countDocuments = () => ({ exec: async () => 3 });

  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  await assert.rejects(
    () => sendJadeMessage({ userId: "premium-user", text: "hello" }),
    JadeTurnLimitReachedError
  );
  assert.equal(fetchCalled, false, "the limit must stop the spend, not just the reply");
});

test("a safety signal produces a deterministic support-first reply and never calls the model", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  stubUserPremium(true);

  const created: Record<string, unknown>[] = [];
  stubSendPath({
    session: makeSessionDoc(),
    onMessageCreate: doc => created.push(doc),
  });

  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const result = await sendJadeMessage({
    userId: "premium-user",
    text: "I want to kill myself",
  });

  assert.equal(fetchCalled, false, "crisis wording must never be sent to the model");
  assert.equal(result.reply.status, "support_first");
  assert.match(result.reply.text, /crisis line|emergency services/i);
  assert.equal(created.length, 2, "both the user message and the reply are persisted");
});

test("an unreachable model still produces a reply so the transcript stays consistent", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  stubUserPremium(true);
  stubSendPath({ session: makeSessionDoc() });

  globalThis.fetch = (async () =>
    new Response("upstream exploded", { status: 500 })) as typeof fetch;

  const result = await sendJadeMessage({
    userId: "premium-user",
    text: "Why do I keep overeating at night?",
  });

  assert.equal(result.reply.status, "fallback");
  assert.ok(result.reply.text.length > 0);
  assert.equal(result.userMessage.text, "Why do I keep overeating at night?");
});

test("a model reply is persisted and returned with the user's turn", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  stubUserPremium(true);
  stubSendPath({ session: makeSessionDoc() });

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          reply: "Your entries suggest the screen-heavy evenings and the late eating travel together.",
          points: [],
          pointStyle: "none",
          visualization: "none",
          usedPatternKeys: ["eats-while-watching-shows"],
          suggestedFollowUp: "",
        }),
      }),
      { status: 200 }
    )) as typeof fetch;

  const result = await sendJadeMessage({
    userId: "premium-user",
    text: "Why do I keep overeating at night?",
  });

  assert.equal(result.reply.status, "ok");
  assert.match(result.reply.text, /travel together/);
  assert.equal(result.reply.role, "assistant");
  assert.equal(result.userMessage.role, "user");
  assert.equal(result.reply.blocks[0]?.type, "text");
});

test("a product privacy question gets a runtime-truthful deterministic reply", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.FIELD_ENCRYPTION_MODE = "disabled";
  stubUserPremium(true);
  stubSendPath({ session: makeSessionDoc() });

  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const result = await sendJadeMessage({
    userId: "premium-user",
    text: "Are my messages safe and encrypted?",
  });

  assert.equal(fetchCalled, false);
  assert.equal(result.reply.status, "product_fact");
  assert.match(result.reply.text, /HTTPS\/TLS/);
  assert.match(result.reply.text, /not end-to-end encrypted/i);
  assert.match(result.reply.text, /not enabled in this environment/i);
});

test("personal safety wording is not mistaken for a product privacy question", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  stubUserPremium(true);
  stubSendPath({ session: makeSessionDoc() });

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          reply: "That sounds unsettling. What would help you feel a little more supported right now?",
          points: [],
          pointStyle: "none",
          visualization: "none",
          usedPatternKeys: [],
          suggestedFollowUp: "",
        }),
      }),
      { status: 200 }
    )) as typeof fetch;

  const result = await sendJadeMessage({
    userId: "premium-user",
    text: "I don't feel safe at home",
  });

  assert.notEqual(result.reply.status, "product_fact");
});

test("the prompt payload carries distilled memory only, never raw journal text", () => {
  const payload = buildJadeUserPayload({
    context: {
      knowledgeGraph: {
        patterns: [
          {
            key: "eats-while-watching-shows",
            label: "eats while watching shows",
            whyNoticed: "Meals happen with a screen on.",
            timesSeen: 6,
            theirWords: "I put a show on and eat.",
          },
        ],
        connections: [],
        clusters: [],
      },
      longTermMemory: "They have been navigating a demanding stretch at work.",
      runningSummary: "",
      recentTurns: [{ role: "user", text: "hello" }],
    },
    latestUserText: "Why do I keep overeating at night?",
  });

  const parsed = JSON.parse(payload) as Record<string, unknown>;

  // The invariant the whole memory system holds: Jade reasons over distilled
  // patterns and the user's own quoted sentences, never entry bodies.
  assert.equal("content" in parsed, false);
  assert.equal("entries" in parsed, false);
  assert.equal("journalEntries" in parsed, false);
  assert.ok("knowledgeGraph" in parsed);
  assert.ok("longTermMemory" in parsed);
});

test("Jade's voice keeps the shipped safety limits and adds its own scope", () => {
  // Jade is the same reflection companion, so the crisis limit and the
  // formal-diagnosis limit must survive the persona deltas. Naming a pattern
  // is allowed; awarding a disorder label as fact is not.
  assert.match(JADE_SYSTEM_PROMPT, /never assert a formal medical or psychiatric diagnosis as established fact/i);
  assert.match(JADE_SYSTEM_PROMPT, /never claim clinical authority, offer treatment, or advise on medication/i);
  assert.match(JADE_SYSTEM_PROMPT, /crisis line/i);
  assert.match(JADE_SYSTEM_PROMPT, /You are Jade\./);
  assert.match(JADE_SYSTEM_PROMPT, /not a general-purpose assistant/i);
});

test("Jade's voice answers directly instead of hedging", () => {
  // The persona previously opened with what it could not know and ended every
  // reply with a question. These are the directives that stop that, and they
  // are the whole point of the surface — assert them so a future softening
  // edit fails loudly rather than quietly restoring the mush.
  assert.match(JADE_SYSTEM_PROMPT, /Answer first/i);
  assert.match(JADE_SYSTEM_PROMPT, /Avoid hedging vocabulary/i);
  assert.match(JADE_SYSTEM_PROMPT, /do not wait to be asked for a list/i);
  assert.match(JADE_SYSTEM_PROMPT, /Do not answer a 'how do I' question with a reflective question/i);
  // Directness is bounded by evidence, not by softness: the no-invention rule
  // is what keeps a blunt claim a true one.
  assert.match(JADE_SYSTEM_PROMPT, /never invent details, events, or failings the user did not write/i);
  assert.match(JADE_SYSTEM_PROMPT, /do not narrate another person's private thoughts, feelings, or motives/i);
});

test("session cursors round-trip and reject tampering", () => {
  const session = makeSessionDoc({ lastMessageAt: new Date("2026-08-10T12:00:00.000Z") });
  const cursor = encodeSessionCursor(session as never);
  const decoded = decodeSessionCursor(cursor);

  assert.equal(decoded.lastMessageAt, "2026-08-10T12:00:00.000Z");
  assert.equal(decoded.id, session._id.toString());

  assert.throws(() => decodeSessionCursor("not-a-cursor"), InvalidJadeCursorError);
  assert.throws(
    () => decodeSessionCursor(Buffer.from('{"id":"x"}').toString("base64url")),
    InvalidJadeCursorError
  );
});

test("transcript cursors round-trip and reject tampering", () => {
  assert.equal(decodeMessageCursor(encodeMessageCursor(42)), 42);
  assert.throws(() => decodeMessageCursor("garbage"), InvalidJadeCursorError);
});

test("listJadeSessions derives hasMore from one extra row and hands back a cursor", async () => {
  stubUserPremium(true);

  const rows = Array.from({ length: 4 }, (_, index) =>
    makeSessionDoc({ lastMessageAt: new Date(2026, 7, 10 - index) })
  );
  // The idle-session sweep issues its own find() alongside this one, so record
  // every call and assert against the first — the list query.
  const calls: { filter: Record<string, unknown>; limit: number }[] = [];

  sessionTarget.find = (filter: Record<string, unknown>) => {
    const call = { filter, limit: 0 };
    calls.push(call);
    return {
      sort: () => ({
        limit: (value: number) => {
          call.limit = value;
          return {
            exec: async () => rows,
            select: () => ({ lean: () => ({ exec: async () => [] }) }),
          };
        },
      }),
    };
  };

  const result = await listJadeSessions({ userId: "premium-user", limit: 3 });

  assert.equal(calls[0]?.limit, 4, "one extra row is what reveals hasMore without a count");
  assert.equal(result.sessions.length, 3);
  assert.equal(result.pagination.hasMore, true);
  assert.ok(result.pagination.nextCursor);
  assert.equal(calls[0]?.filter.userId, "premium-user");
});

test("listJadeSessions builds a keyset filter from the cursor", async () => {
  stubUserPremium(true);

  const filters: Record<string, unknown>[] = [];
  sessionTarget.find = (filter: Record<string, unknown>) => {
    filters.push(filter);
    return {
      sort: () => ({
        limit: () => ({
          exec: async () => [],
          select: () => ({ lean: () => ({ exec: async () => [] }) }),
        }),
      }),
    };
  };

  const cursor = encodeSessionCursor(
    makeSessionDoc({ lastMessageAt: new Date("2026-08-10T12:00:00.000Z") }) as never
  );
  await listJadeSessions({ userId: "premium-user", cursor });

  // Keyset, not skip — the tie-break on _id is what keeps pagination stable
  // when two chats share a timestamp.
  const listFilter = filters[0] || {};
  assert.ok(Array.isArray(listFilter.$or));
  assert.equal((listFilter.$or as unknown[]).length, 2);
});

test("session titles come from the user's own opening line", () => {
  assert.equal(buildSessionTitle("Why do I keep overeating?"), "Why do I keep overeating?");
  assert.equal(buildSessionTitle("  spaced   out  "), "spaced out");

  const long = buildSessionTitle("a".repeat(80));
  assert.ok(long.length <= 48);
  assert.ok(long.endsWith("…"));
});
