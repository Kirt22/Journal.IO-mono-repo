import test from "node:test";
import assert from "node:assert/strict";

import {
  encryptFieldValue,
  FieldEncryptionError,
} from "./fieldEncryption.helpers";
import { decryptLeanFields } from "./fieldEncryption.schema.helpers";

const TEST_KEY = Buffer.alloc(32, 9).toString("hex");

process.env.FIELD_ENCRYPTION_MODE = "migration";
process.env.FIELD_ENCRYPTION_KEYS_JSON = JSON.stringify([
  { id: "test-key", key: TEST_KEY },
]);
process.env.FIELD_ENCRYPTION_ACTIVE_KEY_ID = "test-key";
process.env.FIELD_ENCRYPTION_LOOKUP_HMAC_KEY = TEST_KEY;

test("decryptLeanFields round-trips a top-level encrypted field", () => {
  const row = {
    content: encryptFieldValue("a hard morning", { path: "content" }),
  };

  const decrypted = decryptLeanFields(row, [{ encryptedPath: "content" }]);

  assert.equal(decrypted.content, "a hard morning");
});

test("a subdocument field decrypts against the subdocument, not a dotted parent path", () => {
  // How the schema writes it: `analysis` is declared on the subdocument schema,
  // so that relative path — not `sessionAnalysisSnapshot.analysis` — is the AAD.
  const snapshot = {
    analysis: encryptFieldValue(
      { triggersObserved: [{ trigger: "deadline" }] },
      { path: "analysis" }
    ),
    source: "guided",
  };
  const row = { sessionAnalysisSnapshot: snapshot };

  assert.throws(
    () =>
      decryptLeanFields(row, [
        { encryptedPath: "sessionAnalysisSnapshot.analysis" },
      ]),
    (error: unknown) =>
      error instanceof FieldEncryptionError &&
      error.code === "FIELD_ENCRYPTION_DECRYPT_FAILED"
  );

  const decrypted = decryptLeanFields(snapshot, [
    { encryptedPath: "analysis" },
  ]);

  assert.deepEqual(decrypted.analysis, {
    triggersObserved: [{ trigger: "deadline" }],
  });
  assert.equal(decrypted.source, "guided");
});

test("decryptLeanFields leaves plaintext rows untouched in migration mode", () => {
  const row = { content: "not yet encrypted", tags: ["work"] };

  const decrypted = decryptLeanFields(row, [
    { encryptedPath: "content" },
    { encryptedPath: "tags" },
  ]);

  assert.equal(decrypted.content, "not yet encrypted");
  assert.deepEqual(decrypted.tags, ["work"]);
});
