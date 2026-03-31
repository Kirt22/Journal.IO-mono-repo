import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  getProfileController,
  updateProfileController,
} from "./user.controllers";
import { getProfileSchema, updateProfileSchema } from "./user.validators";

const userRouter: Router = Router();

userRouter.get(
  "/profile",
  verifyJwtToken,
  validateRequest(getProfileSchema),
  getProfileController
);

userRouter.patch(
  "/profile",
  verifyJwtToken,
  validateRequest(updateProfileSchema),
  updateProfileController
);

export default userRouter;
