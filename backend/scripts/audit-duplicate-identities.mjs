#!/usr/bin/env node
// READ-ONLY. Report accounts at risk of the duplicate-identity sign-in failure.
//
// Field encryption rolled out mid-flight, so a database can hold two shapes of user row
// at once: migrated rows with encrypted fields and *LookupHash values, and unmigrated
// plaintext rows with no hashes. When one identity exists in both shapes, signing in
// writes the hashes onto the unmigrated twin and collides with the unique index the
// migrated row already holds — the account can no longer sign in at all.
//
//   MONGO_URI=... node scripts/audit-duplicate-identities.mjs
//
// Exact twin matching needs FIELD_LOOKUP_HMAC_KEY (the same value the API runs with).
// Without it the script still reports the migrated/unmigrated split, which is what
// determines whether the collision is possible at all.

import crypto from "node:crypto";
import process from "node:process";
import "dotenv/config";
import { MongoClient } from "mongodb";

const ENVELOPE_PREFIX = "jioenc:";

const IDENTITIES = [
  { label: "email", field: "email", hashField: "emailLookupHash", path: "users.email" },
  { label: "google", field: "googleUserId", hashField: "googleUserIdLookupHash", path: "users.googleUserId" },
  { label: "apple", field: "appleUserId", hashField: "appleUserIdLookupHash", path: "users.appleUserId" },
];

const isEncrypted = value =>
  typeof value === "string" && value.startsWith(ENVELOPE_PREFIX);

const parseHmacKey = () => {
  const raw = process.env.FIELD_LOOKUP_HMAC_KEY?.trim();

  if (!raw) {
    return null;
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const decoded = Buffer.from(raw, "base64");
  return decoded.length === 32 ? decoded : null;
};

// Mirrors computeLookupHash in src/helpers/fieldEncryption.helpers.ts.
const computeLookupHash = (key, path, value) => {
  const digest = crypto.createHmac("sha256", key);
  digest.update(path);
  digest.update(":");
  digest.update(":");
  digest.update(value.trim());
  return digest.digest("hex");
};

const run = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;

  if (!uri) {
    throw new Error("Set MONGO_URI before running this audit.");
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db();
    const users = db.collection("users");
    const projection = { createdAt: 1 };

    for (const identity of IDENTITIES) {
      projection[identity.field] = 1;
      projection[identity.hashField] = 1;
    }

    const rows = await users.find({}, { projection }).toArray();
    const hmacKey = parseHmacKey();

    console.log(`database : ${db.databaseName}`);
    console.log(`users    : ${rows.length}`);
    console.log(`hmac key : ${hmacKey ? "present (exact twin matching enabled)" : "absent (composition only)"}\n`);

    for (const identity of IDENTITIES) {
      const populated = rows.filter(row => row[identity.field]);
      const migrated = populated.filter(row => row[identity.hashField]);
      const unmigrated = populated.filter(row => !row[identity.hashField]);
      const encrypted = populated.filter(row => isEncrypted(row[identity.field]));

      console.log(`${identity.label}`);
      console.log(`   rows with a value : ${populated.length}`);
      console.log(`   migrated (hashed) : ${migrated.length}`);
      console.log(`   unmigrated        : ${unmigrated.length}`);
      console.log(`   encrypted values  : ${encrypted.length}`);

      if (migrated.length > 0 && unmigrated.length > 0) {
        console.log("   ** mixed state — a twin collision is possible here **");
      }

      // When nothing is encrypted yet, twins are visible directly — two rows holding
      // the same plaintext identity. This needs no key and catches the case the hash
      // comparison below cannot see.
      const plaintextOwners = new Map();
      for (const row of populated) {
        const value = row[identity.field];

        if (isEncrypted(value) || typeof value !== "string") {
          continue;
        }

        const normalized = value.trim().toLowerCase();
        plaintextOwners.set(normalized, [
          ...(plaintextOwners.get(normalized) || []),
          String(row._id),
        ]);
      }

      const plaintextDuplicates = [...plaintextOwners.entries()].filter(
        ([, ids]) => ids.length > 1
      );

      console.log(`   duplicate values  : ${plaintextDuplicates.length}`);
      plaintextDuplicates.forEach(([, ids]) =>
        console.log(`      rows sharing one identity: ${ids.join(", ")}`)
      );

      if (!hmacKey || unmigrated.length === 0) {
        console.log("");
        continue;
      }

      const hashOwners = new Map();
      for (const row of migrated) {
        hashOwners.set(row[identity.hashField], row._id);
      }

      const twins = [];
      for (const row of unmigrated) {
        const value = row[identity.field];

        if (isEncrypted(value) || typeof value !== "string") {
          continue;
        }

        const owner = hashOwners.get(computeLookupHash(hmacKey, identity.path, value));

        if (owner) {
          twins.push({ stray: String(row._id), keep: String(owner) });
        }
      }

      console.log(`   confirmed twins   : ${twins.length}`);
      twins.forEach(twin =>
        console.log(`      --keep ${twin.keep} --stray ${twin.stray}`)
      );
      console.log("");
    }
  } finally {
    await client.close();
  }
};

run().catch(error => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
