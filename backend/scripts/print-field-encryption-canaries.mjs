#!/usr/bin/env node
// Print FIELD_ENCRYPTION_CANARY and FIELD_LOOKUP_HMAC_CANARY for the configured keys.
//
// `assertFieldEncryptionReady` refuses to boot in migration/enforced mode unless both
// canaries are present AND round-trip against the live keys, so these values are not
// free-form: they are derived from FIELD_ENCRYPTION_KEYS_JSON and FIELD_LOOKUP_HMAC_KEY.
// A hand-written value fails the check and takes the server down at startup.
//
// This imports the real `buildFieldEncryptionCanaries` from dist rather than
// reimplementing it, so the values can never drift from what startup validates.
//
//   npm run build
//   FIELD_ENCRYPTION_ACTIVE_KEY_ID=... \
//   FIELD_ENCRYPTION_KEYS_JSON='{"...":"..."}' \
//   FIELD_LOOKUP_HMAC_KEY=... \
//   node scripts/print-field-encryption-canaries.mjs
//
// Re-run this whenever the active key or the HMAC key changes, and update both
// canary variables together with the keys that produced them.

import process from "node:process";
import { buildFieldEncryptionCanaries } from "../dist/helpers/fieldEncryption.helpers.js";

const REQUIRED = [
  "FIELD_ENCRYPTION_ACTIVE_KEY_ID",
  "FIELD_ENCRYPTION_KEYS_JSON",
  "FIELD_LOOKUP_HMAC_KEY",
];

const missing = REQUIRED.filter(name => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(`Missing required variables: ${missing.join(", ")}`);
  process.exit(1);
}

const { ciphertext, lookupDigest } = buildFieldEncryptionCanaries();

if (!ciphertext || !lookupDigest) {
  console.error(
    "Canary generation produced an empty value. Check that FIELD_ENCRYPTION_ACTIVE_KEY_ID " +
      "names a key present in FIELD_ENCRYPTION_KEYS_JSON."
  );
  process.exit(1);
}

console.log(`FIELD_ENCRYPTION_CANARY=${ciphertext}`);
console.log(`FIELD_LOOKUP_HMAC_CANARY=${lookupDigest}`);
