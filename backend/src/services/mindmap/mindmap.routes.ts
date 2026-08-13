import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import { getEntryMindMapController } from "./mindmap.controllers";
import { getEntryMindMapSchema } from "./mindmap.validators";

const mindMapRouter: Router = Router();

mindMapRouter.get(
  "/entry/:journalId",
  verifyJwtToken,
  validateRequest(getEntryMindMapSchema),
  getEntryMindMapController
);

export default mindMapRouter;
