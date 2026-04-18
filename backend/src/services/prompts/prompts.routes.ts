import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import { getWritingPromptsController } from "./prompts.controllers";
import { getWritingPromptsSchema } from "./prompts.validators";

const promptsRouter = Router();

promptsRouter.get(
  "/writing",
  verifyJwtToken,
  validateRequest(getWritingPromptsSchema),
  getWritingPromptsController
);

export default promptsRouter;
