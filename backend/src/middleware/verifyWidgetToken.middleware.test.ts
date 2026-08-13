import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { userModel } from "../schema/user.schema";
import { widgetSessionModel } from "../schema/widget_session.schema";
import { hashWidgetToken } from "../services/widgets/widgets.service";
import { verifyWidgetToken } from "./verifyWidgetToken.middleware";

type QueryResult<T> = {
  exec: () => Promise<T>;
};

const widgetSessionTarget = widgetSessionModel as unknown as {
  findOne: (...args: unknown[]) => QueryResult<unknown>;
  updateOne: (...args: unknown[]) => QueryResult<{ matchedCount: number }>;
  deleteOne: (...args: unknown[]) => QueryResult<unknown>;
};
const userTarget = userModel as unknown as {
  findById: (...args: unknown[]) => Promise<unknown>;
};

const originalFindOne = widgetSessionTarget.findOne;
const originalUpdateOne = widgetSessionTarget.updateOne;
const originalDeleteOne = widgetSessionTarget.deleteOne;
const originalUserFindById = userTarget.findById;
const premiumUser = {
  widgetSessionVersion: 0,
  isPremium: true,
  premiumPlanKey: "lifetime",
  premiumSource: "revenuecat_verified",
};

const buildResponse = () => {
  let statusCode = 200;
  let payload: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(value: unknown) {
      payload = value;
      return response;
    },
  } as unknown as Response;

  return {
    response,
    getPayload: () => payload,
    getStatusCode: () => statusCode,
  };
};

const buildSession = (userId: string) => ({
  _id: { toString: () => "session-123" },
  userId: { toString: () => userId },
  platform: "ios",
  installationId: "installation-123",
  sessionVersion: 0,
});

afterEach(() => {
  widgetSessionTarget.findOne = originalFindOne;
  widgetSessionTarget.updateOne = originalUpdateOne;
  widgetSessionTarget.deleteOne = originalDeleteOne;
  userTarget.findById = originalUserFindById;
});

test("verifyWidgetToken authenticates as the session owner, not a claimed user", async () => {
  const token = "w".repeat(43);
  const lookupQueries: unknown[][] = [];
  const updateQueries: unknown[][] = [];
  widgetSessionTarget.findOne = (...args) => ({
    exec: async () => {
      lookupQueries.push(args);
      return buildSession("stored-user");
    },
  });
  widgetSessionTarget.updateOne = (...args) => ({
    exec: async () => {
      updateQueries.push(args);
      return { matchedCount: 1 };
    },
  });
  userTarget.findById = async () => premiumUser;
  const request = {
    headers: { authorization: `Widget ${token}` },
    body: { userId: "claimed-user" },
  } as Request;
  const { response } = buildResponse();
  let nextCalled = false;

  await verifyWidgetToken(request, response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, true);
  assert.equal(request.widgetSession?.userId, "stored-user");
  const lookup = lookupQueries[0]?.[0] as {
    tokenHash: string;
    expiresAt: { $gt: Date };
  };
  assert.equal(lookup.tokenHash, hashWidgetToken(token));
  assert.ok(lookup.expiresAt.$gt instanceof Date);
  assert.equal(updateQueries.length, 1);
  assert.deepEqual(
    (updateQueries[0]?.[0] as { tokenHash: string }).tokenHash,
    hashWidgetToken(token)
  );
});

test("verifyWidgetToken rejects malformed and expired credentials", async () => {
  let lookupCount = 0;
  widgetSessionTarget.findOne = () => ({
    exec: async () => {
      lookupCount += 1;
      return null;
    },
  });
  const malformedRequest = {
    headers: { authorization: `Bearer ${"w".repeat(43)}` },
  } as Request;
  const malformedResponse = buildResponse();

  await verifyWidgetToken(
    malformedRequest,
    malformedResponse.response,
    (() => undefined) as NextFunction
  );

  assert.equal(malformedResponse.getStatusCode(), 401);
  assert.equal(lookupCount, 0);

  const expiredRequest = {
    headers: { authorization: `Widget ${"w".repeat(43)}` },
  } as Request;
  const expiredResponse = buildResponse();

  await verifyWidgetToken(
    expiredRequest,
    expiredResponse.response,
    (() => undefined) as NextFunction
  );

  assert.equal(expiredResponse.getStatusCode(), 401);
  assert.equal(lookupCount, 1);
  assert.deepEqual(expiredResponse.getPayload(), {
    success: false,
    message: "Please sign in to continue.",
    data: {},
  });
});

test("verifyWidgetToken rejects and removes a session whose user no longer exists", async () => {
  const deleteQueries: unknown[][] = [];
  widgetSessionTarget.findOne = () => ({
    exec: async () => buildSession("deleted-user"),
  });
  widgetSessionTarget.deleteOne = (...args) => ({
    exec: async () => {
      deleteQueries.push(args);
      return { deletedCount: 1 };
    },
  });
  userTarget.findById = async () => null;
  const request = {
    headers: { authorization: `Widget ${"w".repeat(43)}` },
  } as Request;
  const { response, getStatusCode } = buildResponse();

  await verifyWidgetToken(request, response, (() => undefined) as NextFunction);

  assert.equal(getStatusCode(), 401);
  assert.equal(deleteQueries.length, 1);
  const deletedSessionId = (deleteQueries[0]?.[0] as {
    _id: { toString: () => string };
  })._id;
  assert.equal(deletedSessionId.toString(), "session-123");
});

test("verifyWidgetToken rejects a credential revoked during verification", async () => {
  widgetSessionTarget.findOne = () => ({
    exec: async () => buildSession("stored-user"),
  });
  widgetSessionTarget.updateOne = () => ({
    exec: async () => ({ matchedCount: 0 }),
  });
  userTarget.findById = async () => premiumUser;
  const request = {
    headers: { authorization: `Widget ${"w".repeat(43)}` },
  } as Request;
  const { response, getStatusCode } = buildResponse();
  let nextCalled = false;

  await verifyWidgetToken(request, response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(getStatusCode(), 401);
  assert.equal(nextCalled, false);
});

test("verifyWidgetToken rejects and removes sessions after Premium ends", async () => {
  const deleteQueries: unknown[][] = [];
  widgetSessionTarget.findOne = () => ({
    exec: async () => buildSession("free-user"),
  });
  widgetSessionTarget.deleteOne = (...args) => ({
    exec: async () => {
      deleteQueries.push(args);
      return { deletedCount: 1 };
    },
  });
  userTarget.findById = async () => ({
    widgetSessionVersion: 0,
    isPremium: false,
  });
  const request = {
    headers: { authorization: `Widget ${"w".repeat(43)}` },
  } as Request;
  const { response, getPayload, getStatusCode } = buildResponse();
  let nextCalled = false;

  await verifyWidgetToken(request, response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(getStatusCode(), 403);
  assert.equal(nextCalled, false);
  assert.equal(deleteQueries.length, 1);
  assert.deepEqual(getPayload(), {
    success: false,
    message: "Journal.IO Premium is required for interactive widgets.",
    data: {},
  });
});

test("verifyWidgetToken rejects a session from an older revocation version", async () => {
  const deleteQueries: unknown[][] = [];
  widgetSessionTarget.findOne = () => ({
    exec: async () => buildSession("stored-user"),
  });
  widgetSessionTarget.deleteOne = (...args) => ({
    exec: async () => {
      deleteQueries.push(args);
      return { deletedCount: 1 };
    },
  });
  userTarget.findById = async () => ({ widgetSessionVersion: 1 });
  const request = {
    headers: { authorization: `Widget ${"w".repeat(43)}` },
  } as Request;
  const { response, getStatusCode } = buildResponse();

  await verifyWidgetToken(request, response, (() => undefined) as NextFunction);

  assert.equal(getStatusCode(), 401);
  assert.equal(deleteQueries.length, 1);
});
