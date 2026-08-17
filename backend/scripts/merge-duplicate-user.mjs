#!/usr/bin/env node
// Merge a duplicate user row into the account that owns the real data, then remove it.
//
// Field encryption rolled out mid-flight, so some identities exist twice: an encrypted
// row carrying the unique *LookupHash values, and an older plaintext twin created while
// hashing was off. Both rows are real accounts as far as the app is concerned, and the
// stray one usually holds a little data from the sessions that landed on it.
//
//   node scripts/merge-duplicate-user.mjs --keep <id> --stray <id>            # dry run
//   node scripts/merge-duplicate-user.mjs --keep <id> --stray <id> --apply    # writes
//
// Dry run is the default and prints exactly what --apply would do. Every document the
// stray row owns is written to a JSON backup before anything is modified.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";

const OWNER_FIELDS = ["userId", "user", "user_id", "ownerId"];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = { apply: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--keep" || arg === "--stray") {
      options[arg.slice(2)] = args[index + 1];
      index += 1;
    } else {
      throw new Error(`Unrecognized argument: ${arg}`);
    }
  }

  if (!options.keep || !options.stray) {
    throw new Error(
      "Both --keep <userId> and --stray <userId> are required.\n" +
        "  --keep  the account whose data is authoritative\n" +
        "  --stray the duplicate row to merge in and delete"
    );
  }

  if (options.keep === options.stray) {
    throw new Error("--keep and --stray must be different rows.");
  }

  return options;
};

const resolveMongoUri = () => {
  const uri = process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;

  if (!uri) {
    throw new Error("Set MONGO_URI (or MONGO_URI_LOCAL) before running this script.");
  }

  return uri;
};

// A unique index that includes the owner field constrains the merged row, not the two
// rows separately. Two documents that were legal apart can collide once combined.
const buildConflictQuery = (index, document, ownerField, keepId) => {
  const query = {};

  for (const key of Object.keys(index.key)) {
    query[key] = key === ownerField ? keepId : document[key];
  }

  return query;
};

const run = async () => {
  const options = parseArgs();
  const client = new MongoClient(resolveMongoUri());

  await client.connect();

  try {
    const db = client.db();
    const users = db.collection("users");
    const keepId = new ObjectId(options.keep);
    const strayId = new ObjectId(options.stray);

    const keepUser = await users.findOne({ _id: keepId });
    const strayUser = await users.findOne({ _id: strayId });

    if (!keepUser) {
      throw new Error(`No user row found for --keep ${options.keep}`);
    }

    if (!strayUser) {
      throw new Error(`No user row found for --stray ${options.stray}`);
    }

    console.log(`database : ${db.databaseName}`);
    console.log(`keep     : ${options.keep}  (created ${keepUser.createdAt?.toISOString?.() ?? "?"})`);
    console.log(`stray    : ${options.stray}  (created ${strayUser.createdAt?.toISOString?.() ?? "?"})`);
    console.log(`mode     : ${options.apply ? "APPLY (writes)" : "dry run"}\n`);

    const collections = (await db.listCollections().toArray())
      .map(entry => entry.name)
      .filter(name => name !== "users")
      .sort();

    const backup = { generatedAt: new Date().toISOString(), keepUser, strayUser, owned: {} };
    const plan = [];

    for (const name of collections) {
      const collection = db.collection(name);

      for (const ownerField of OWNER_FIELDS) {
        // Ids are stored as ObjectId in most places and as a string in a few, so match both.
        const ownerQuery = { [ownerField]: { $in: [strayId, options.stray] } };
        const documents = await collection.find(ownerQuery).toArray();

        if (documents.length === 0) {
          continue;
        }

        backup.owned[`${name}.${ownerField}`] = documents;

        const uniqueIndexes = (await collection.indexes()).filter(
          index => index.unique && Object.keys(index.key).includes(ownerField)
        );

        const movable = [];
        const blocked = [];

        for (const document of documents) {
          let conflict = null;

          for (const index of uniqueIndexes) {
            const query = buildConflictQuery(index, document, ownerField, keepId);
            const existing = await collection.findOne(query);

            if (existing) {
              conflict = index.name;
              break;
            }
          }

          if (conflict) {
            blocked.push({ _id: document._id, index: conflict });
          } else {
            movable.push(document._id);
          }
        }

        plan.push({ name, ownerField, movable, blocked });
      }
    }

    if (plan.length === 0) {
      console.log("The stray row owns no documents. Only the user row needs removing.\n");
    }

    for (const entry of plan) {
      console.log(`${entry.name}.${entry.ownerField}`);
      console.log(`   move   : ${entry.movable.length}`);

      if (entry.blocked.length > 0) {
        // The keeper already has the authoritative version of these, and the unique
        // index will not hold both. Derived records (insights, pattern nodes) regenerate,
        // so the keeper's copy wins and the stray's is dropped — it stays in the backup.
        const reasons = [...new Set(entry.blocked.map(item => item.index))].join(", ");
        console.log(`   drop   : ${entry.blocked.length}  (the keeper already has one; unique ${reasons})`);
      }
    }

    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const backupDir = path.join(scriptDir, "..", "backups");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `merge-user-${options.stray}-${stamp}.json`);

    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`\nbackup written: ${backupPath}`);

    if (!options.apply) {
      console.log("\nDry run — nothing was modified. Re-run with --apply to perform the merge.");
      return;
    }

    let moved = 0;
    let dropped = 0;

    for (const entry of plan) {
      const collection = db.collection(entry.name);

      if (entry.movable.length > 0) {
        const result = await collection.updateMany(
          { _id: { $in: entry.movable } },
          { $set: { [entry.ownerField]: keepId } }
        );
        moved += result.modifiedCount;
      }

      if (entry.blocked.length > 0) {
        const result = await collection.deleteMany({
          _id: { $in: entry.blocked.map(item => item._id) },
        });
        dropped += result.deletedCount;
      }
    }

    const removal = await users.deleteOne({ _id: strayId });

    console.log(`\nmoved   : ${moved} documents`);
    console.log(`dropped : ${dropped} documents (superseded by the keeper's copy)`);
    console.log(`stray user row deleted: ${removal.deletedCount === 1}`);
  } finally {
    await client.close();
  }
};

run().catch(error => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
