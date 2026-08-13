import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { getUserMemory, updateUserMemory } from "./userMemory.service";
import { userMemoryModel } from "../../schema/userMemory.schema";
import { userModel } from "../../schema/user.schema";

const memoryTarget = userMemoryModel as unknown as {
  findOne: (query: unknown) => unknown;
};
const userTarget = userModel as unknown as {
  findById: (userId: string) => unknown;
};

const originalMemoryFindOne = memoryTarget.findOne;
const originalUserFindById = userTarget.findById;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalFetch = globalThis.fetch;

afterEach(() => {
  memoryTarget.findOne = originalMemoryFindOne;
  userTarget.findById = originalUserFindById;
  globalThis.fetch = originalFetch;
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
