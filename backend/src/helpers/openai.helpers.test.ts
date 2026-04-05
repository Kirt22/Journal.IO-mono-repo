import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { z } from "zod";
import { requestStructuredOpenAi } from "./openai.helpers";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalConsoleError = console.error;

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;

  if (typeof originalApiKey === "string") {
    process.env.OPENAI_API_KEY = originalApiKey;
  } else {
    delete process.env.OPENAI_API_KEY;
  }
});

test("requestStructuredOpenAi returns parsed structured output", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          value: "structured result",
        }),
      }),
      { status: 200 }
    )) as typeof fetch;

  const result = await requestStructuredOpenAi({
    feature: "test feature",
    schemaName: "test_schema",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["value"],
      properties: {
        value: { type: "string" },
      },
    },
    parser: z.object({
      value: z.string(),
    }),
    messages: [
      {
        role: "system",
        content: "Return structured output.",
      },
    ],
  });

  assert.deepEqual(result, { value: "structured result" });
});

test("requestStructuredOpenAi returns null when structured output does not match the parser", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  console.error = () => {};
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          wrongField: true,
        }),
      }),
      { status: 200 }
    )) as typeof fetch;

  const result = await requestStructuredOpenAi({
    feature: "test feature",
    schemaName: "test_schema",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["value"],
      properties: {
        value: { type: "string" },
      },
    },
    parser: z.object({
      value: z.string(),
    }),
    messages: [
      {
        role: "system",
        content: "Return structured output.",
      },
    ],
  });

  assert.equal(result, null);
});
