import assert from "node:assert/strict";
import test from "node:test";
import { getMongoStage, resolveMongoUri } from "./mongo.db.config";

test("resolveMongoUri prefers MONGO_URI when it is configured", () => {
  const mongoUri = resolveMongoUri({
    MONGO_URI: "mongodb+srv://cluster.example.com/journal-io",
    MONGO_STAGE: "prod",
    MONGO_URI_PROD: "mongodb+srv://ignored.example.com/journal-io",
  });

  assert.equal(mongoUri, "mongodb+srv://cluster.example.com/journal-io");
});

test("resolveMongoUri falls back to the local default database when no env is set", () => {
  const mongoUri = resolveMongoUri({});

  assert.equal(mongoUri, "mongodb://localhost:27017/journal_io");
});

test("getMongoStage rejects unsupported stage values", () => {
  assert.throws(
    () => getMongoStage({ MONGO_STAGE: "staging" }),
    /Invalid MONGO_STAGE value/
  );
});

test("resolveMongoUri rejects missing production MongoDB config", () => {
  assert.throws(
    () => resolveMongoUri({ MONGO_STAGE: "prod" }),
    /MongoDB connection string is not configured/
  );
});
