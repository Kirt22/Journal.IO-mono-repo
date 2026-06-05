import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import { getHomeOfferConfigController } from "./admin.controllers";
import { getHomeOfferConfigSchema } from "./admin.validators";

const adminRouter = Router();

adminRouter.get(
  "/home-offer",
  verifyJwtToken,
  validateRequest(getHomeOfferConfigSchema),
  getHomeOfferConfigController
);

export default adminRouter;
