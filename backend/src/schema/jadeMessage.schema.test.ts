import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  decryptFieldValue,
  isEncryptedEnvelope,
} from "../helpers/fieldEncryption.helpers";
import { jadeMessageModel } from "./jadeMessage.schema";

const originalMode = process.env.FIELD_ENCRYPTION_MODE;
const originalActiveKeyId = process.env.FIELD_ENCRYPTION_ACTIVE_KEY_ID;
const originalKeys = process.env.FIELD_ENCRYPTION_KEYS_JSON;

afterEach(() => {
  if (originalMode === undefined) delete process.env.FIELD_ENCRYPTION_MODE;
  else process.env.FIELD_ENCRYPTION_MODE = originalMode;
  if (originalActiveKeyId === undefined) delete process.env.FIELD_ENCRYPTION_ACTIVE_KEY_ID;
  else process.env.FIELD_ENCRYPTION_ACTIVE_KEY_ID = originalActiveKeyId;
  if (originalKeys === undefined) delete process.env.FIELD_ENCRYPTION_KEYS_JSON;
  else process.env.FIELD_ENCRYPTION_KEYS_JSON = originalKeys;
});

test("Jade structured blocks use the encrypted schema path", () => {
  process.env.FIELD_ENCRYPTION_MODE = "migration";
  process.env.FIELD_ENCRYPTION_ACTIVE_KEY_ID = "test-key";
  process.env.FIELD_ENCRYPTION_KEYS_JSON = JSON.stringify({
    "test-key": "22".repeat(32),
  });

  const blocks = [
    { type: "text", text: "Here is your mood trend." },
    {
      type: "mood_trend",
      title: "Mood trend",
      dataState: "ready",
      updatedAt: null,
      rangeDays: 7,
      points: [{ dateKey: "2026-08-14", label: "Aug 14", mood: "good", score: 4 }],
    },
  ];
  const blocksPath = jadeMessageModel.schema.path("blocks");
  const storedValue = blocksPath.applySetters(blocks, {});

  assert.equal(isEncryptedEnvelope(storedValue), true);
  assert.deepEqual(decryptFieldValue(storedValue, { path: "blocks" }), blocks);
});
