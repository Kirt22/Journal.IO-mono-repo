import assert from "node:assert/strict";
import test from "node:test";
import {
  deletePrivacyAccountSchema,
  exportPrivacyDataSchema,
  updateAiOptOutSchema,
} from "./privacy.validators";

test("exportPrivacyDataSchema accepts an empty POST payload", () => {
  const result = exportPrivacyDataSchema.safeParse({
    body: {},
    query: {},
    params: {},
  });

  assert.equal(result.success, true);
});

test("deletePrivacyAccountSchema accepts an empty POST payload", () => {
  const result = deletePrivacyAccountSchema.safeParse({
    body: {},
    query: {},
    params: {},
  });

  assert.equal(result.success, true);
});

test("updateAiOptOutSchema accepts a boolean preference payload", () => {
  const result = updateAiOptOutSchema.safeParse({
    body: { aiOptOut: true },
    query: {},
    params: {},
  });

  assert.equal(result.success, true);
});
