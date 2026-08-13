import type { NextFunction, Request, Response } from "express";
import { API_MESSAGES, apiResponse } from "../helpers/commonHelper.helpers";
import { hasActivePremiumEntitlement } from "../helpers/premiumEntitlement.helpers";
import { userModel } from "../schema/user.schema";
import { widgetSessionModel, type WidgetPlatform } from "../schema/widget_session.schema";
import {
  hashWidgetToken,
  normalizeWidgetSessionVersion,
} from "../services/widgets/widgets.service";

export type WidgetSessionAuth = {
  sessionId: string;
  userId: string;
  platform: WidgetPlatform;
  installationId: string;
};

declare global {
  namespace Express {
    interface Request {
      widgetSession?: WidgetSessionAuth;
    }
  }
}

const unauthorizedWidgetResponse = (res: Response) =>
  res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));

const verifyWidgetToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authorization = req.headers.authorization?.trim() || "";
  const [scheme, token, ...extraParts] = authorization.split(/\s+/);

  if (
    scheme !== "Widget" ||
    !token ||
    extraParts.length > 0 ||
    token.length < 32 ||
    token.length > 256
  ) {
    return unauthorizedWidgetResponse(res);
  }

  try {
    const now = new Date();
    const tokenHash = hashWidgetToken(token);
    const session = await widgetSessionModel
      .findOne({
        tokenHash,
        expiresAt: { $gt: now },
      })
      .exec();

    if (!session) {
      return unauthorizedWidgetResponse(res);
    }

    const existingUser = await userModel.findById(session.userId);

    if (
      !existingUser ||
      normalizeWidgetSessionVersion(existingUser.widgetSessionVersion) !==
        normalizeWidgetSessionVersion(session.sessionVersion)
    ) {
      await widgetSessionModel.deleteOne({ _id: session._id }).exec();
      return unauthorizedWidgetResponse(res);
    }

    if (!hasActivePremiumEntitlement(existingUser)) {
      await widgetSessionModel.deleteOne({ _id: session._id }).exec();
      return res
        .status(403)
        .json(
          apiResponse(
            false,
            "Journal.IO Premium is required for interactive widgets.",
            {}
          )
        );
    }

    const touchResult = await widgetSessionModel
      .updateOne(
        { _id: session._id, tokenHash, expiresAt: { $gt: now } },
        { $set: { lastUsedAt: now } }
      )
      .exec();

    if (touchResult.matchedCount !== 1) {
      return unauthorizedWidgetResponse(res);
    }

    req.widgetSession = {
      sessionId: session._id.toString(),
      userId: session.userId.toString(),
      platform: session.platform,
      installationId: session.installationId,
    };

    return next();
  } catch (error) {
    console.error("Widget credential verification failed:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export { verifyWidgetToken };
