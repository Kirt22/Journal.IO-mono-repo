import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { z } from "zod";
import {
  requestStructuredOpenAi,
  requestStructuredOpenAiDetailed,
} from "./openai.helpers";

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

test("requestStructuredOpenAi sends a feature-level model and high reasoning effort", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let requestBody: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

    return new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          value: "structured result",
        }),
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  await requestStructuredOpenAi({
    feature: "session analysis",
    schemaName: "session_analysis",
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
    model: "gpt-5.6-terra",
    reasoningEffort: "high",
  });

  const capturedRequestBody = requestBody as Record<string, unknown> | null;
  assert.ok(capturedRequestBody);
  assert.equal(capturedRequestBody.model, "gpt-5.6-terra");
  assert.deepEqual(capturedRequestBody.reasoning, { effort: "high" });
});

test("requestStructuredOpenAiDetailed distinguishes incomplete output", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  console.error = () => {};
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        id: "resp_safe_metadata",
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
        output_text: "sensitive partial content",
      }),
      { status: 200 }
    )) as typeof fetch;

  const result = await requestStructuredOpenAiDetailed({
    feature: "test feature",
    schemaName: "test_schema",
    schema: { type: "object" },
    parser: z.object({ value: z.string() }),
    messages: [{ role: "system", content: "Return structured output." }],
  });

  assert.deepEqual(result, { data: null, failure: "incomplete" });
});
