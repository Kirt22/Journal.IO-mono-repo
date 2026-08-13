import type { Request, Response } from "express";
import { API_MESSAGES, apiResponse } from "../../helpers/commonHelper.helpers";
import { logMoodCheckInWithStatus } from "../mood/mood.service";
import { issueWidgetSession, revokeWidgetSession } from "./widgets.service";

const createWidgetSessionController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const session = await issueWidgetSession({
      userId,
      platform: req.body.platform,
      installationId: req.body.installationId,
      sessionVersion: req.accessTokenClaims?.widgetSessionVersion ?? 0,
    });

    return res
      .status(201)
      .json(apiResponse(true, "Your widget is connected.", session));
  } catch (error) {
    console.error("Error in createWidgetSessionController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const deleteWidgetSessionController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    await revokeWidgetSession({
      userId,
      platform: req.body.platform,
      installationId: req.body.installationId,
    });

    return res
      .status(200)
      .json(apiResponse(true, "Your widget has been disconnected.", {}));
  } catch (error) {
    console.error("Error in deleteWidgetSessionController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const logWidgetMoodController = async (req: Request, res: Response) => {
  try {
    const userId = req.widgetSession?.userId;

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const timeZoneHeader =
      typeof req.headers["x-client-timezone"] === "string"
        ? req.headers["x-client-timezone"]
        : undefined;
    const { moodCheckIn, alreadyCheckedIn } = await logMoodCheckInWithStatus({
      userId,
      mood: req.body.mood,
      ...(timeZoneHeader ? { timeZone: timeZoneHeader } : {}),
    });

    return res
      .status(200)
      .json(
        apiResponse(true, "Your check-in has been saved.", {
          saved: true,
          moodDateKey: moodCheckIn.moodDateKey,
          mood: moodCheckIn.mood,
          alreadyCheckedIn,
        })
      );
  } catch (error) {
    console.error("Error in logWidgetMoodController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export {
  createWidgetSessionController,
  deleteWidgetSessionController,
  logWidgetMoodController,
};
