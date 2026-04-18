import assert from "node:assert/strict";
import test from "node:test";
import { getWritingPromptsSchema } from "./prompts.validators";

test("getWritingPromptsSchema accepts an empty GET request", () => {
  const result = getWritingPromptsSchema.safeParse({});
  assert.equal(result.success, true);
});
