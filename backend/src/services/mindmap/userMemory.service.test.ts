import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { getUserMemory, updateUserMemory } from "./userMemory.service";
import { userMemoryModel } from "../../schema/userMemory.schema";
import { userModel } from "../../schema/user.schema";
import * as entryInsightService from "./entryInsight.service";
import { encryptFieldValue } from "../../helpers/fieldEncryption.helpers";

const memoryTarget = userMemoryModel as unknown as {
  findOne: (query: unknown) => unknown;
  updateOne: (query: unknown, update: never) => unknown;
};
const insightTarget = entryInsightService as unknown as {
  loadEntryInsights: (input: unknown) => Promise<unknown[]>;
};
const userTarget = userModel as unknown as {
  findById: (userId: string) => unknown;
};

const originalMemoryFindOne = memoryTarget.findOne;
const originalMemoryUpdateOne = memoryTarget.updateOne;
const originalLoadEntryInsights = insightTarget.loadEntryInsights;
const originalUserFindById = userTarget.findById;
const originalEncryptionEnv = {
  mode: process.env.FIELD_ENCRYPTION_MODE,
  keys: process.env.FIELD_ENCRYPTION_KEYS_JSON,
  activeKeyId: process.env.FIELD_ENCRYPTION_ACTIVE_KEY_ID,
};
const originalApiKey = process.env.OPENAI_API_KEY;
const originalFetch = globalThis.fetch;

afterEach(() => {
  memoryTarget.findOne = originalMemoryFindOne;
  memoryTarget.updateOne = originalMemoryUpdateOne;
  insightTarget.loadEntryInsights = originalLoadEntryInsights;
  userTarget.findById = originalUserFindById;
  globalThis.fetch = originalFetch;
  for (const [key, value] of [
    ["FIELD_ENCRYPTION_MODE", originalEncryptionEnv.mode],
    ["FIELD_ENCRYPTION_KEYS_JSON", originalEncryptionEnv.keys],
    ["FIELD_ENCRYPTION_ACTIVE_KEY_ID", originalEncryptionEnv.activeKeyId],
  ] as const) {
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
  if (typeof originalApiKey === "string") {
    process.env.OPENAI_API_KEY = originalApiKey;
  } else {
    delete process.env.OPENAI_API_KEY;
  }
});

test("getUserMemory maps a persisted document", async () => {
  memoryTarget.findOne = () => ({
    lean: () => ({
      exec: async () => ({
        narrative: "They have been working through a job change.",
        structured: {
          ongoingThreads: [{ label: "Job change", status: "interviewing" }],
          keyRelationships: ["partner"],
          sensitiveTopics: ["a recent loss"],
        },
        entriesCoveredThrough: new Date("2026-01-05"),
        entriesCoveredCount: 12,
        version: "user-memory-v1",
        aiModel: "gpt-test",
        updatedAt: new Date("2026-01-06"),
      }),
    }),
  });

  const memory = await getUserMemory("u1");

  assert.equal(memory.narrative, "They have been working through a job change.");
  assert.equal(memory.structured.ongoingThreads[0]?.label, "Job change");
  assert.deepEqual(memory.structured.sensitiveTopics, ["a recent loss"]);
  assert.equal(memory.entriesCoveredCount, 12);
});

test("getUserMemory returns a safe empty memory when the read fails", async () => {
  memoryTarget.findOne = () => ({
    lean: () => ({
      exec: async () => {
        throw new Error("no db");
      },
    }),
  });

  const memory = await getUserMemory("u1");

  assert.equal(memory.narrative, "");
  assert.deepEqual(memory.structured.ongoingThreads, []);
  assert.deepEqual(memory.structured.keyRelationships, []);
  assert.deepEqual(memory.structured.sensitiveTopics, []);
});

test("updateUserMemory is premium-gated: a non-premium user never calls the model", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: false,
        }),
      }),
    }),
  });

  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  await updateUserMemory("free-user");

  assert.equal(fetchCalled, false);
});

test("what updateUserMemory writes is what getUserMemory can read back", async () => {
  // Regression guard for the production AAD contract. The service has always
  // written these manual envelopes with dotted parent paths, so reads must use
  // those same strings rather than silently creating a second ciphertext form.
  process.env.OPENAI_API_KEY = "test-key";
  process.env.FIELD_ENCRYPTION_MODE = "migration";
  process.env.FIELD_ENCRYPTION_KEYS_JSON = JSON.stringify([
    { id: "round-trip-key", key: Buffer.alloc(32, 7).toString("hex") },
  ]);
  process.env.FIELD_ENCRYPTION_ACTIVE_KEY_ID = "round-trip-key";

  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: true,
          premiumPlanKey: "lifetime",
          premiumExpiresAt: null,
          premiumSource: "revenuecat_verified",
        }),
      }),
    }),
  });
  insightTarget.loadEntryInsights = async () => [
    {
      contextSummary: "A late shift ran long again.",
      emotionalTone: "worn down",
      themes: [{ label: "workload" }],
      entryCreatedAt: new Date("2026-02-10T20:00:00.000Z"),
    },
  ];
  memoryTarget.findOne = () => ({ lean: () => ({ exec: async () => null }) });

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          narrative: "They have been carrying a heavy stretch at work.",
          ongoingThreads: [{ label: "Workload", status: "still heavy" }],
          keyRelationships: ["their manager"],
          sensitiveTopics: ["burnout"],
        }),
      }),
      { status: 200 }
    )) as typeof fetch;

  let written: Record<string, unknown> | null = null;
  memoryTarget.updateOne = async (
    _query: unknown,
    update: { $set: Record<string, unknown> }
  ) => {
    written = update.$set;
    return { acknowledged: true };
  };

  await updateUserMemory("premium-user");

  assert.ok(written, "updateUserMemory did not persist anything.");
  const persisted = written as Record<string, unknown>;
  const structured = persisted.structured as Record<string, unknown>;

  // Sanity: the values really were encrypted, so the read below is a genuine
  // decrypt and not a migration-mode plaintext passthrough.
  assert.match(String(persisted.narrative), /^jioenc:/);
  assert.match(String(structured.keyRelationships), /^jioenc:/);
  assert.match(String(structured.sensitiveTopics), /^jioenc:/);
  const threads = structured.ongoingThreads as Record<string, unknown>[];
  assert.match(String(threads[0]?.label), /^jioenc:/);
  assert.match(String(threads[0]?.status), /^jioenc:/);

  // Now read exactly those bytes back through the real service.
  memoryTarget.findOne = () => ({
    lean: () => ({ exec: async () => persisted }),
  });

  const memory = await getUserMemory("premium-user");

  assert.equal(
    memory.narrative,
    "They have been carrying a heavy stretch at work."
  );
  assert.deepEqual(memory.structured.keyRelationships, ["their manager"]);
  assert.deepEqual(memory.structured.sensitiveTopics, ["burnout"]);
  assert.equal(memory.structured.ongoingThreads[0]?.label, "Workload");
  assert.equal(memory.structured.ongoingThreads[0]?.status, "still heavy");
});

test("the refresh prompt gets decrypted memory, never ciphertext", async () => {
  // updateUserMemory reads the previous memory with .lean(), which bypasses the
  // schema getters. Passing that row's fields straight into the prompt sends the
  // model "jioenc:..." envelopes and asks it to summarize them as the user's own
  // history — the memory then degrades a little more with every refresh.
  process.env.OPENAI_API_KEY = "test-key";
  process.env.FIELD_ENCRYPTION_MODE = "migration";
  process.env.FIELD_ENCRYPTION_KEYS_JSON = JSON.stringify([
    { id: "prompt-key", key: Buffer.alloc(32, 3).toString("hex") },
  ]);
  process.env.FIELD_ENCRYPTION_ACTIVE_KEY_ID = "prompt-key";

  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: true,
          premiumPlanKey: "lifetime",
          premiumExpiresAt: null,
          premiumSource: "revenuecat_verified",
        }),
      }),
    }),
  });
  insightTarget.loadEntryInsights = async () => [
    {
      contextSummary: "Another late finish.",
      emotionalTone: "flat",
      themes: [{ label: "work" }],
      entryCreatedAt: new Date("2026-03-01T21:00:00.000Z"),
    },
  ];

  // A previously persisted row, encrypted exactly as the service writes it.
  const storedRow = {
    narrative: encryptFieldValue(
      "They have been running on empty since February.",
      { path: "narrative" }
    ),
    structured: {
      ongoingThreads: [
        {
          label: encryptFieldValue("Workload", {
            path: "structured.ongoingThreads.label",
          }),
          status: encryptFieldValue("unresolved", {
            path: "structured.ongoingThreads.status",
          }),
        },
      ],
      keyRelationships: encryptFieldValue(["their sister"], {
        path: "structured.keyRelationships",
      }),
      sensitiveTopics: encryptFieldValue(["a bereavement"], {
        path: "structured.sensitiveTopics",
      }),
    },
    entriesCoveredThrough: null,
    entriesCoveredCount: 4,
  };
  memoryTarget.findOne = () => ({
    lean: () => ({ exec: async () => storedRow }),
  });
  memoryTarget.updateOne = async () => ({ acknowledged: true });

  let sentBody = "";
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    sentBody = String(init?.body ?? "");
    return new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          narrative: "Still stretched, but naming it more directly now.",
          ongoingThreads: [{ label: "Workload", status: "being named" }],
          keyRelationships: ["their sister"],
          sensitiveTopics: ["a bereavement"],
        }),
      }),
      { status: 200 }
    );
  }) as unknown as typeof fetch;

  await updateUserMemory("premium-user");

  assert.ok(sentBody, "updateUserMemory never called the model.");
  assert.ok(
    !sentBody.includes("jioenc:"),
    "The prompt carried an encrypted envelope instead of plaintext memory."
  );
  assert.ok(
    sentBody.includes("They have been running on empty since February."),
    "The prompt did not carry the decrypted narrative."
  );
  assert.ok(
    sentBody.includes("their sister") && sentBody.includes("a bereavement"),
    "The prompt did not carry the decrypted structured memory."
  );
  assert.ok(
    sentBody.includes("Workload") && sentBody.includes("unresolved"),
    "The prompt did not carry the decrypted ongoing threads."
  );
});
