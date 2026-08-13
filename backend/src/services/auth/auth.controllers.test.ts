import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import type { Request, Response } from "express";
import { userModel } from "../../schema/user.schema";
import { widgetSessionModel } from "../../schema/widget_session.schema";
import { logoutController } from "./auth.controllers";

const userTarget = userModel as unknown as {
  updateOne: (...args: unknown[]) => Promise<unknown>;
};
const widgetSessionTarget = widgetSessionModel as unknown as {
  deleteMany: (...args: unknown[]) => {
    exec: () => Promise<{ deletedCount?: number }>;
  };
};

const originalUserUpdateOne = userTarget.updateOne;
const originalWidgetDeleteMany = widgetSessionTarget.deleteMany;

afterEach(() => {
  userTarget.updateOne = originalUserUpdateOne;
  widgetSessionTarget.deleteMany = originalWidgetDeleteMany;
});

test("logoutController revokes refresh and widget sessions for the user", async () => {
  const refreshQueries: unknown[][] = [];
  const widgetQueries: unknown[][] = [];
  userTarget.updateOne = async (...args) => {
    refreshQueries.push(args);
    return { matchedCount: 1 };
  };
  widgetSessionTarget.deleteMany = (...args) => ({
    exec: async () => {
      widgetQueries.push(args);
      return { deletedCount: 2 };
    },
  });
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
  const request = {
    user: { _id: { toString: () => "user-123" } },
  } as Request & { user?: { _id?: string } };

  await logoutController(request, response);

  assert.equal(statusCode, 200);
  assert.deepEqual(payload, {
    success: true,
    message: "You're signed out.",
    data: {},
  });
  assert.equal(refreshQueries.length, 1);
  assert.deepEqual(refreshQueries[0]?.[0], { _id: "user-123" });
  assert.deepEqual(refreshQueries[0]?.[1], {
    $set: {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    },
    $inc: {
      widgetSessionVersion: 1,
    },
  });
  assert.deepEqual(widgetQueries, [[{ userId: "user-123" }]]);
});
