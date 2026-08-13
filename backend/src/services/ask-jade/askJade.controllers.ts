import { Request, Response } from "express";
import {
  apiResponse,
  API_MESSAGES,
  notFoundMessage,
} from "../../helpers/commonHelper.helpers";
import { PremiumFeatureRequiredError } from "../../helpers/aiAccess.helpers";
import {
  InvalidJadeCursorError,
  JadeTurnLimitReachedError,
  deleteJadeSession,
  getJadeSession,
  listJadeSessions,
  sendJadeMessage,
} from "./askJade.service";

type AuthedRequest = Request & { user?: { _id?: string } };

const readUserId = (req: AuthedRequest): string | null =>
  req.user?._id?.toString() || null;

const readLimit = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
};

const readCursor = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/**
 * Every Ask Jade error that has a meaningful client behaviour gets its own code,
 * so the app can show a locked card, a limit notice, or a retry rather than one
 * generic failure.
 */
const handleAskJadeError = (
  error: unknown,
  res: Response,
  context: string
): Response => {
  if (error instanceof PremiumFeatureRequiredError) {
    return res
      .status(403)
      .json(
        apiResponse(false, error.message, {}, { error: { code: "PREMIUM_REQUIRED" } })
      );
  }

  if (error instanceof JadeTurnLimitReachedError) {
    return res.status(429).json(
      apiResponse(
        false,
        error.message,
        { resetAt: error.resetAt.toISOString() },
        { error: { code: "JADE_TURN_LIMIT" } }
      )
    );
  }

  if (error instanceof InvalidJadeCursorError) {
    return res
      .status(400)
      .json(
        apiResponse(false, error.message, {}, { error: { code: "INVALID_JADE_CURSOR" } })
      );
  }

  console.error(`Error in ${context}:`, error);
  return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
};

const listJadeSessionsController = async (req: AuthedRequest, res: Response) => {
  try {
    const userId = readUserId(req);
    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const limit = readLimit(req.query.limit);
    const cursor = readCursor(req.query.cursor);

    const sessions = await listJadeSessions({
      userId,
      ...(limit ? { limit } : {}),
      ...(cursor ? { cursor } : {}),
    });

    return res
      .status(200)
      .json(apiResponse(true, "Your chats with Jade are ready.", sessions));
  } catch (error) {
    return handleAskJadeError(error, res, "listJadeSessionsController");
  }
};

const getJadeSessionController = async (req: AuthedRequest, res: Response) => {
  try {
    const userId = readUserId(req);
    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const limit = readLimit(req.query.limit);
    const cursor = readCursor(req.query.cursor);

    const thread = await getJadeSession({
      userId,
      sessionId: String(req.params.sessionId),
      ...(limit ? { limit } : {}),
      ...(cursor ? { cursor } : {}),
    });

    if (!thread) {
      return res.status(404).json(apiResponse(false, notFoundMessage("chat"), {}));
    }

    return res.status(200).json(apiResponse(true, "Your chat is ready.", thread));
  } catch (error) {
    return handleAskJadeError(error, res, "getJadeSessionController");
  }
};

const sendJadeMessageController = async (req: AuthedRequest, res: Response) => {
  try {
    const userId = readUserId(req);
    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const sessionId =
      typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : undefined;
    const timeZone =
      typeof req.headers["x-client-timezone"] === "string"
        ? req.headers["x-client-timezone"].trim()
        : undefined;

    const result = await sendJadeMessage({
      userId,
      ...(sessionId ? { sessionId } : {}),
      ...(timeZone ? { timeZone } : {}),
      text: String(req.body?.text ?? ""),
    });

    // A model failure is still a 200: the reply was persisted as a fallback and
    // the transcript stays consistent, which the client renders with a retry.
    return res.status(200).json(apiResponse(true, "Jade replied.", result));
  } catch (error) {
    return handleAskJadeError(error, res, "sendJadeMessageController");
  }
};

const deleteJadeSessionController = async (req: AuthedRequest, res: Response) => {
  try {
    const userId = readUserId(req);
    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const deleted = await deleteJadeSession({
      userId,
      sessionId: String(req.params.sessionId),
    });

    if (!deleted) {
      return res.status(404).json(apiResponse(false, notFoundMessage("chat"), {}));
    }

    return res.status(200).json(apiResponse(true, "That chat is gone.", {}));
  } catch (error) {
    return handleAskJadeError(error, res, "deleteJadeSessionController");
  }
};

export {
  deleteJadeSessionController,
  getJadeSessionController,
  listJadeSessionsController,
  sendJadeMessageController,
};
