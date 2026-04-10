import { Request, Response } from "express";
import { apiResponse } from "../../helpers/commonHelper.helpers";
import {
  getPaywallConfig,
  syncPaywallPurchase,
  trackPaywallEvent,
} from "./paywall.service";

const getPaywallConfigController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const placementKey =
      typeof req.query.placementKey === "string" ? req.query.placementKey : "";
    const screenKey =
      typeof req.query.screenKey === "string" ? req.query.screenKey : undefined;
    const currentStage =
      typeof req.query.currentStage === "string"
        ? req.query.currentStage
        : undefined;
    const triggerMode =
      req.query.triggerMode === "interruptive" ? "interruptive" : "contextual";
    const decision = await getPaywallConfig(userId, {
      placementKey,
      triggerMode,
      ...(screenKey ? { screenKey } : {}),
      ...(currentStage ? { currentStage } : {}),
    });

    if (!decision) {
      return res.status(404).json(apiResponse(false, "User not found", {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Paywall config loaded", decision));
  } catch (error) {
    console.error("Error in getPaywallConfigController:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const trackPaywallEventController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const result = await trackPaywallEvent(userId, req.body);

    return res
      .status(201)
      .json(apiResponse(true, "Paywall event tracked", result));
  } catch (error) {
    console.error("Error in trackPaywallEventController:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const syncPaywallPurchaseController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const profile = await syncPaywallPurchase(userId, req.body);

    if (!profile) {
      return res.status(404).json(apiResponse(false, "User not found", {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Paywall purchase synced", profile));
  } catch (error) {
    console.error("Error in syncPaywallPurchaseController:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

export {
  getPaywallConfigController,
  syncPaywallPurchaseController,
  trackPaywallEventController,
};
