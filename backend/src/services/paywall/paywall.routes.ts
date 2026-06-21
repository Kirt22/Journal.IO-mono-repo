import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  getPaywallConfigController,
  syncPaywallEntitlementController,
  syncPaywallPurchaseController,
  trackPaywallEventController,
} from "./paywall.controllers";
import {
  getPaywallConfigSchema,
  syncPaywallEntitlementSchema,
  syncPaywallPurchaseSchema,
  trackPaywallEventSchema,
} from "./paywall.validators";

const paywallRouter = Router();

paywallRouter.get(
  "/config",
  verifyJwtToken,
  validateRequest(getPaywallConfigSchema),
  getPaywallConfigController
);

paywallRouter.post(
  "/events",
  verifyJwtToken,
  validateRequest(trackPaywallEventSchema),
  trackPaywallEventController
);

paywallRouter.post(
  "/purchase-sync",
  verifyJwtToken,
  validateRequest(syncPaywallPurchaseSchema),
  syncPaywallPurchaseController
);

paywallRouter.post(
  "/entitlement-sync",
  verifyJwtToken,
  validateRequest(syncPaywallEntitlementSchema),
  syncPaywallEntitlementController
);

export default paywallRouter;
