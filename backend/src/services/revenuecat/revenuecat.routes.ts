import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { processRevenueCatWebhookController } from "./revenuecat.controllers";
import { revenueCatWebhookSchema } from "./revenuecat.validators";

const revenueCatRouter = Router();

revenueCatRouter.post(
  "/revenuecat",
  validateRequest(revenueCatWebhookSchema),
  processRevenueCatWebhookController
);

export default revenueCatRouter;
