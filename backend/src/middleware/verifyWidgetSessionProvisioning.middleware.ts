import type { NextFunction, Request, Response } from "express";
import { API_MESSAGES, apiResponse } from "../helpers/commonHelper.helpers";
import { hasActivePremiumEntitlement } from "../helpers/premiumEntitlement.helpers";
import { normalizeWidgetSessionVersion } from "../services/widgets/widgets.service";

const verifyWidgetSessionProvisioning = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || !req.accessTokenClaims) {
    return res
      .status(401)
      .json(apiResponse(false, API_MESSAGES.unauthorized, {}));
  }

  const userVersion = normalizeWidgetSessionVersion(
    req.user.widgetSessionVersion
  );
  const tokenVersion = normalizeWidgetSessionVersion(
    req.accessTokenClaims.widgetSessionVersion
  );

  if (tokenVersion !== userVersion) {
    return res
      .status(401)
      .json(apiResponse(false, API_MESSAGES.sessionExpired, {}));
  }

  if (
    req.method === "POST" &&
    !hasActivePremiumEntitlement(req.user)
  ) {
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

  return next();
};

export { verifyWidgetSessionProvisioning };
