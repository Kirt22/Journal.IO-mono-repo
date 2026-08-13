import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  buildProductPrivacyReply,
  isProductPrivacyQuestion,
} from "./productPrivacy.helpers";

const originalMode = process.env.FIELD_ENCRYPTION_MODE;

afterEach(() => {
  if (typeof originalMode === "string") process.env.FIELD_ENCRYPTION_MODE = originalMode;
  else delete process.env.FIELD_ENCRYPTION_MODE;
});

test("privacy intent requires app-data context", () => {
  assert.equal(isProductPrivacyQuestion("Are my messages safe and encrypted?"), true);
  assert.equal(isProductPrivacyQuestion("Who can read my journal entries?"), true);
  assert.equal(isProductPrivacyQuestion("I do not feel safe at home"), false);
});

test("privacy disclosure reflects the active encryption mode", () => {
  process.env.FIELD_ENCRYPTION_MODE = "disabled";
  assert.match(buildProductPrivacyReply(), /not enabled/i);

  process.env.FIELD_ENCRYPTION_MODE = "migration";
  assert.match(buildProductPrivacyReply(), /rollout/i);

  process.env.FIELD_ENCRYPTION_MODE = "enforced";
  assert.match(buildProductPrivacyReply(), /encryption at rest/i);
  assert.match(buildProductPrivacyReply(), /not end-to-end encrypted/i);
});
