import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  getProfileController,
  updatePremiumStatusController,
  updateProfileController,
} from "./user.controllers";
import {
  getProfileSchema,
  updatePremiumStatusSchema,
  updateProfileSchema,
} from "./user.validators";

const userRouter: Router = Router();

userRouter.get(
  "/profile",
  verifyJwtToken,
  validateRequest(getProfileSchema),
  getProfileController
);

userRouter.patch(
  "/premium-status",
  verifyJwtToken,
  validateRequest(updatePremiumStatusSchema),
  updatePremiumStatusController
);

userRouter.patch(
  "/profile",
  verifyJwtToken,
  validateRequest(updateProfileSchema),
  updateProfileController
);

export default userRouter;
