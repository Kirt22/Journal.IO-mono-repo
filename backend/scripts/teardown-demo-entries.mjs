#!/usr/bin/env node
// Remove seeded demo journal data for one account.
//
// Companion to scripts/seed-demo-entries.mjs. Two scopes:
//
//   default        only documents carrying the seed marker { seedTag: "demo-seed-2026-08" }
//   --all          every journal/derived document for the account, seeded or not
//   --include-jade also drop Ask Jade sessions/messages (real conversation
//                  history, so never removed unless asked for)
//
// `--all` is what you want before a fresh seed run, because analytics are
// aggregates: a single stray entry from an earlier session shifts the Topic
// Snapshot percentages and the weekly window. The seed script calls this module
// itself, so re-running the seed replaces rather than duplicates.
//
// Dry-run by default — same convention as merge-duplicate-user.mjs. Nothing is
// written until --apply.
//
//   npm run build
//   node scripts/teardown-demo-entries.mjs --email=someone@example.com
//   node scripts/teardown-demo-entries.mjs --email=someone@example.com --all --apply
//
// Derived documents are keyed by journalId, not by the marker, so a marker-scoped
// run resolves the seeded journal ids first and deletes their derived rows by id.
// Aggregate documents (insights, user memory, pattern graph) have no per-entry
// identity at all: they are rebuilt from whatever journals remain, so they are
// always dropped wholesale and regenerated.

import process from "node:process";
import { pathToFileURL } from "node:url";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import { computeLookupHash } from "../dist/helpers/fieldEncryption.helpers.js";

export const SEED_TAG = "demo-seed-2026-08";

const readFlag = (argv, name) => argv.includes(`--${name}`);

const readOption = (argv, name) => {
  const prefix = `--${name}=`;
  const match = argv.find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
};

// users.email is encrypted, so the plaintext address is not queryable. The
// deterministic lookup hash is what the unique index and every auth path use.
export const findUserIdByEmail = async (db, email) => {
  const normalized = email.trim().toLowerCase();
  const emailLookupHash = computeLookupHash({
    value: normalized,
    path: "users.email",
  });

  if (!emailLookupHash) {
    throw new Error(
      "computeLookupHash returned null. FIELD_LOOKUP_HMAC_KEY is missing or not a " +
        "32-byte base64/hex value in this process's environment."
    );
  }

  const matches = await db
    .collection("users")
    .find({ emailLookupHash }, { projection: { _id: 1 } })
    .toArray();

  if (matches.length === 0) {
    throw new Error(
      `No user matches ${normalized}. Check the address, and that this process ` +
        "loaded the same FIELD_LOOKUP_HMAC_KEY the API runs with."
    );
  }

  if (matches.length > 1) {
    throw new Error(
      `${matches.length} users match ${normalized}. Resolve the duplicate with ` +
        "scripts/merge-duplicate-user.mjs before seeding."
    );
  }

  return matches[0]._id;
};

/**
 * @returns {Promise<Record<string, number>>} deleted (or matched, when dry-run)
 *   document counts per collection.
 */
export const teardownDemoData = async ({
  db,
  userId,
  all = false,
  apply = false,
  includeJade = false,
}) => {
  const journalFilter = all
    ? { userId }
    : { userId, seedTag: SEED_TAG };

  const journalIds = await db
    .collection("journals")
    .find(journalFilter, { projection: { _id: 1 } })
    .toArray()
    .then(rows => rows.map(row => row._id));

  const byJournal = all ? { userId } : { journalId: { $in: journalIds } };
  const moodFilter = all ? { userId } : { userId, seedTag: SEED_TAG };

  // Aggregates carry no per-entry identity — they are always rebuilt from the
  // journals that survive, so scoping them to the marker would leave stale totals.
  const targets = [
    ["journals", journalFilter],
    ["mindmap_entry_scores", byJournal],
    ["entry_insights", byJournal],
    ["mood_checkins", moodFilter],
    ["insights", { userId }],
    ["user_memories", { userId }],
    ["pattern_nodes", { userId }],
    ["pattern_edges", { userId }],
    ["streaks", { userId }],
    ["stats", { userId }],
  ];

  // Jade threads quote journal entries by id, so after a wipe they cite writing
  // the account can no longer open. They are still real conversation history
  // though, and nothing in the seed needs them gone — so this is opt-in.
  if (includeJade) {
    targets.push(["jade_messages", { userId }], ["jade_sessions", { userId }]);
  }

  const counts = {};

  for (const [collection, filter] of targets) {
    const matched = await db.collection(collection).countDocuments(filter);
    counts[collection] = matched;

    if (apply && matched > 0) {
      await db.collection(collection).deleteMany(filter);
    }
  }

  return counts;
};

const run = async () => {
  const argv = process.argv.slice(2);
  const email = readOption(argv, "email");
  const all = readFlag(argv, "all");
  const apply = readFlag(argv, "apply");
  const includeJade = readFlag(argv, "include-jade");

  if (!email) {
    console.error("Usage: node scripts/teardown-demo-entries.mjs --email=<address> [--all] [--include-jade] [--apply]");
    process.exit(1);
  }

  const uri = process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;

  if (!uri) {
    throw new Error("Set MONGO_URI or MONGO_URI_LOCAL before running teardown.");
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db();
    const userId = await findUserIdByEmail(db, email);

    console.log(`account   ${email} -> ${userId.toString()}`);
    console.log(`database  ${db.databaseName}`);
    console.log(`scope     ${all ? "ALL data for this account" : `marker "${SEED_TAG}" only`}`);
    console.log(`mode      ${apply ? "APPLY (deleting)" : "dry run (nothing written)"}`);
    console.log("");

    const counts = await teardownDemoData({ db, userId, all, apply, includeJade });
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    for (const [collection, count] of Object.entries(counts)) {
      console.log(`  ${count > 0 ? String(count).padStart(4) : "   ."}  ${collection}`);
    }

    console.log("");
    console.log(
      apply
        ? `Deleted ${total} documents.`
        : `${total} documents would be deleted. Re-run with --apply.`
    );
  } finally {
    await client.close();
  }
};

// Only run the CLI when invoked directly, so the seed script can import the
// teardown helpers without triggering a delete. pathToFileURL, not a template
// string — this repo lives under a path with a space in it, which import.meta.url
// percent-encodes and a hand-built file:// URL does not.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
