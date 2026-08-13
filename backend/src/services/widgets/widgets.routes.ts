import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import { verifyWidgetToken } from "../../middleware/verifyWidgetToken.middleware";
import { verifyWidgetSessionProvisioning } from "../../middleware/verifyWidgetSessionProvisioning.middleware";
import {
  createWidgetSessionController,
  deleteWidgetSessionController,
  logWidgetMoodController,
} from "./widgets.controllers";
import { widgetMoodCheckInSchema, widgetSessionSchema } from "./widgets.validators";

const widgetsRouter: Router = Router();

widgetsRouter.post(
  "/session",
  verifyJwtToken,
  verifyWidgetSessionProvisioning,
  validateRequest(widgetSessionSchema),
  createWidgetSessionController
);

widgetsRouter.delete(
  "/session",
  verifyJwtToken,
  verifyWidgetSessionProvisioning,
  validateRequest(widgetSessionSchema),
  deleteWidgetSessionController
);

widgetsRouter.post(
  "/mood/check_in",
  verifyWidgetToken,
  validateRequest(widgetMoodCheckInSchema),
  logWidgetMoodController
);

export default widgetsRouter;
