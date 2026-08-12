import assert from "node:assert/strict";
import test from "node:test";
import {
  getJadeSessionSchema,
  listJadeSessionsSchema,
  sendJadeMessageSchema,
} from "./askJade.validators";

const parseSend = (body: unknown) =>
  sendJadeMessageSchema.safeParse({ body, query: {}, params: {} });

test("sendJadeMessage accepts a message with no sessionId, which opens a new chat", () => {
  const result = parseSend({ text: "Why do I keep doing this at night?" });

  assert.equal(result.success, true);
});

test("sendJadeMessage requires something to actually send", () => {
  assert.equal(parseSend({ text: "" }).success, false);
  assert.equal(parseSend({ text: "   " }).success, false);
  assert.equal(parseSend({}).success, false);
});

test("sendJadeMessage caps message length so one turn cannot blow the context", () => {
  assert.equal(parseSend({ text: "a".repeat(2000) }).success, true);
  assert.equal(parseSend({ text: "a".repeat(2001) }).success, false);
});

test("sendJadeMessage rejects a non-string sessionId", () => {
  assert.equal(parseSend({ sessionId: 12345, text: "hello" }).success, false);
});

test("listJadeSessions bounds the page size and accepts a cursor", () => {
  const parse = (query: unknown) =>
    listJadeSessionsSchema.safeParse({ body: {}, query, params: {} });

  assert.equal(parse({}).success, true);
  assert.equal(parse({ limit: "20", cursor: "abc" }).success, true);
  assert.equal(parse({ limit: "0" }).success, false);
  assert.equal(parse({ limit: "31" }).success, false);
});

test("getJadeSession requires a session id and bounds the transcript page", () => {
  const parse = (params: unknown, query: unknown = {}) =>
    getJadeSessionSchema.safeParse({ body: {}, query, params });

  assert.equal(parse({ sessionId: "abc" }).success, true);
  assert.equal(parse({ sessionId: "abc" }, { limit: "50" }).success, true);
  assert.equal(parse({ sessionId: "abc" }, { limit: "51" }).success, false);
  assert.equal(parse({}).success, false);
  assert.equal(parse({ sessionId: "  " }).success, false);
});
