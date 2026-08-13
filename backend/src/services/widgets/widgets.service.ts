import crypto from "node:crypto";
import { widgetSessionModel, type WidgetPlatform } from "../../schema/widget_session.schema";

const WIDGET_TOKEN_BYTES = 32;
const WIDGET_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_WIDGET_SESSIONS = 5;

type WidgetSessionIdentity = {
  userId: string;
  platform: WidgetPlatform;
  installationId: string;
};

type IssueWidgetSessionOptions = WidgetSessionIdentity & {
  sessionVersion: number;
  now?: Date;
};

type IssuedWidgetSession = {
  widgetToken: string;
  expiresAt: string;
};

const hashWidgetToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const normalizeWidgetSessionVersion = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;

const generateWidgetToken = () => crypto.randomBytes(WIDGET_TOKEN_BYTES).toString("base64url");

const removeExcessWidgetSessions = async (userId: string, now: Date) => {
  const excessSessions = await widgetSessionModel
    .find({ userId, expiresAt: { $gt: now } })
    .sort({ lastUsedAt: -1, updatedAt: -1 })
    .skip(MAX_ACTIVE_WIDGET_SESSIONS)
    .select({ _id: 1 })
    .lean()
    .exec();

  if (excessSessions.length === 0) {
    return;
  }

  await widgetSessionModel
    .deleteMany({ _id: { $in: excessSessions.map(session => session._id) } })
    .exec();
};

const issueWidgetSession = async ({
  userId,
  platform,
  installationId,
  sessionVersion,
  now = new Date(),
}: IssueWidgetSessionOptions): Promise<IssuedWidgetSession> => {
  const widgetToken = generateWidgetToken();
  const expiresAt = new Date(now.getTime() + WIDGET_SESSION_DURATION_MS);

  await widgetSessionModel
    .findOneAndUpdate(
      { userId, platform, installationId: installationId.trim() },
      {
        $set: {
          tokenHash: hashWidgetToken(widgetToken),
          sessionVersion: normalizeWidgetSessionVersion(sessionVersion),
          expiresAt,
          lastUsedAt: now,
        },
        $setOnInsert: {
          userId,
          platform,
          installationId: installationId.trim(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    .exec();

  await removeExcessWidgetSessions(userId, now);

  return {
    widgetToken,
    expiresAt: expiresAt.toISOString(),
  };
};

const revokeWidgetSession = async ({
  userId,
  platform,
  installationId,
}: WidgetSessionIdentity): Promise<void> => {
  await widgetSessionModel
    .deleteOne({ userId, platform, installationId: installationId.trim() })
    .exec();
};

const revokeAllWidgetSessions = async (userId: string): Promise<void> => {
  await widgetSessionModel.deleteMany({ userId }).exec();
};

export {
  MAX_ACTIVE_WIDGET_SESSIONS,
  WIDGET_SESSION_DURATION_MS,
  hashWidgetToken,
  issueWidgetSession,
  normalizeWidgetSessionVersion,
  revokeAllWidgetSessions,
  revokeWidgetSession,
};
