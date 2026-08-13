import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { widgetSessionModel } from "../../schema/widget_session.schema";
import {
  MAX_ACTIVE_WIDGET_SESSIONS,
  WIDGET_SESSION_DURATION_MS,
  hashWidgetToken,
  issueWidgetSession,
  revokeAllWidgetSessions,
  revokeWidgetSession,
} from "./widgets.service";

type QueryResult<T> = {
  exec: () => Promise<T>;
};

type SessionId = {
  _id: string;
};

const widgetSessionTarget = widgetSessionModel as unknown as {
  findOneAndUpdate: (...args: unknown[]) => QueryResult<unknown>;
  find: (...args: unknown[]) => {
    sort: (...args: unknown[]) => {
      skip: (...args: unknown[]) => {
        select: (...args: unknown[]) => {
          lean: () => QueryResult<SessionId[]>;
        };
      };
    };
  };
  deleteMany: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
  deleteOne: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};

const originalFindOneAndUpdate = widgetSessionTarget.findOneAndUpdate;
const originalFind = widgetSessionTarget.find;
const originalDeleteMany = widgetSessionTarget.deleteMany;
const originalDeleteOne = widgetSessionTarget.deleteOne;

const mockSessionIssuance = (excessSessions: SessionId[] = []) => {
  const upserts: unknown[][] = [];
  const deleteQueries: unknown[][] = [];

  widgetSessionTarget.findOneAndUpdate = (...args) => ({
    exec: async () => {
      upserts.push(args);
      return {};
    },
  });
  widgetSessionTarget.find = () => ({
    sort: () => ({
      skip: () => ({
        select: () => ({
          lean: () => ({ exec: async () => excessSessions }),
        }),
      }),
    }),
  });
  widgetSessionTarget.deleteMany = (...args) => ({
    exec: async () => {
      deleteQueries.push(args);
      return { deletedCount: excessSessions.length };
    },
  });

  return { deleteQueries, upserts };
};

afterEach(() => {
  widgetSessionTarget.findOneAndUpdate = originalFindOneAndUpdate;
  widgetSessionTarget.find = originalFind;
  widgetSessionTarget.deleteMany = originalDeleteMany;
  widgetSessionTarget.deleteOne = originalDeleteOne;
});

test("widget session schema enforces installation uniqueness and TTL expiry", () => {
  const indexes = widgetSessionModel.schema.indexes() as Array<
    [Record<string, number>, Record<string, unknown>]
  >;
  const installationIndex = indexes.find(
    ([fields]) =>
      fields.userId === 1 &&
      fields.platform === 1 &&
      fields.installationId === 1
  );
  const expiryIndex = indexes.find(([fields]) => fields.expiresAt === 1);

  assert.equal(installationIndex?.[1].unique, true);
  assert.equal(expiryIndex?.[1].expireAfterSeconds, 0);
});

test("issueWidgetSession rotates a 256-bit token and stores only its hash", async () => {
  const now = new Date("2026-07-22T12:00:00.000Z");
  const { upserts } = mockSessionIssuance();

  const first = await issueWidgetSession({
    userId: "user-123",
    platform: "ios",
    installationId: "installation-123",
    sessionVersion: 2,
    now,
  });
  const second = await issueWidgetSession({
    userId: "user-123",
    platform: "ios",
    installationId: "installation-123",
    sessionVersion: 2,
    now,
  });

  assert.notEqual(first.widgetToken, second.widgetToken);
  assert.equal(Buffer.from(first.widgetToken, "base64url").length, 32);
  assert.equal(
    new Date(first.expiresAt).getTime() - now.getTime(),
    WIDGET_SESSION_DURATION_MS
  );
  assert.equal(upserts.length, 2);

  const [filter, update, options] = upserts[0] as [
    Record<string, unknown>,
    { $set: { tokenHash: string; sessionVersion: number } },
    Record<string, unknown>,
  ];
  assert.deepEqual(filter, {
    userId: "user-123",
    platform: "ios",
    installationId: "installation-123",
  });
  assert.equal(update.$set.tokenHash, hashWidgetToken(first.widgetToken));
  assert.notEqual(update.$set.tokenHash, first.widgetToken);
  assert.equal(update.$set.sessionVersion, 2);
  assert.equal(options.upsert, true);
});

test("issueWidgetSession removes active sessions beyond the per-user cap", async () => {
  const excessSessions = [{ _id: "session-6" }, { _id: "session-7" }];
  const { deleteQueries } = mockSessionIssuance(excessSessions);

  await issueWidgetSession({
    userId: "user-123",
    platform: "ios",
    installationId: "installation-123",
    sessionVersion: 0,
  });

  assert.equal(MAX_ACTIVE_WIDGET_SESSIONS, 5);
  assert.deepEqual(deleteQueries, [
    [{ _id: { $in: ["session-6", "session-7"] } }],
  ]);
});

test("revokeWidgetSession is scoped to the authenticated user and installation", async () => {
  const deleteQueries: unknown[][] = [];
  widgetSessionTarget.deleteOne = (...args) => ({
    exec: async () => {
      deleteQueries.push(args);
      return { deletedCount: 1 };
    },
  });

  await revokeWidgetSession({
    userId: "user-123",
    platform: "ios",
    installationId: " installation-123 ",
  });

  assert.deepEqual(deleteQueries, [
    [
      {
        userId: "user-123",
        platform: "ios",
        installationId: "installation-123",
      },
    ],
  ]);
});

test("revokeAllWidgetSessions removes every credential owned by one user", async () => {
  const deleteQueries: unknown[][] = [];
  widgetSessionTarget.deleteMany = (...args) => ({
    exec: async () => {
      deleteQueries.push(args);
      return { deletedCount: 3 };
    },
  });

  await revokeAllWidgetSessions("user-123");

  assert.deepEqual(deleteQueries, [[{ userId: "user-123" }]]);
});
