import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_ACTION_BALANCE_GUIDANCE,
  AI_EXTRACTION_BALANCE_GUIDANCE,
  AI_REFLECTION_BALANCE_GUIDANCE,
} from "./aiReflectionBalance.helpers";

test("reflection balance guidance is challenge-aware without manufacturing negatives", () => {
  assert.match(AI_REFLECTION_BALANCE_GUIDANCE, /55%/);
  assert.match(AI_REFLECTION_BALANCE_GUIDANCE, /45%/);
  assert.match(AI_REFLECTION_BALANCE_GUIDANCE, /Do not invent/i);
  assert.match(AI_REFLECTION_BALANCE_GUIDANCE, /warm, steady, constructive/i);
});

test("extraction and action guidance preserve evidence and user agency", () => {
  assert.match(AI_EXTRACTION_BALANCE_GUIDANCE, /Do not invent negative/i);
  assert.match(
    AI_EXTRACTION_BALANCE_GUIDANCE,
    /negated, conflicted, or distressed/i
  );
  assert.match(AI_ACTION_BALANCE_GUIDANCE, /small, optional, constructive/i);
  assert.match(AI_ACTION_BALANCE_GUIDANCE, /Never invent a problem/i);
});
