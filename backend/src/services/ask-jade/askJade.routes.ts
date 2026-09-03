import { Router } from "express";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import {
  deleteJadeSessionController,
  getJadeSessionController,
  listJadeSessionsController,
  sendJadeMessageController,
} from "./askJade.controllers";
import {
  deleteJadeSessionSchema,
  getJadeSessionSchema,
  listJadeSessionsSchema,
  sendJadeMessageSchema,
} from "./askJade.validators";
import { authenticatedAiRateLimit } from "../../middleware/security.middleware";

const askJadeRouter: Router = Router();

askJadeRouter.get(
  "/sessions",
  verifyJwtToken,
  validateRequest(listJadeSessionsSchema),
  listJadeSessionsController
);

// There is no POST /sessions: sending a message without a sessionId opens the
// conversation, so an abandoned "New chat" tap never leaves an empty session.
askJadeRouter.post(
  "/messages",
  verifyJwtToken,
  authenticatedAiRateLimit,
  validateRequest(sendJadeMessageSchema),
  sendJadeMessageController
);

askJadeRouter.get(
  "/sessions/:sessionId",
  verifyJwtToken,
  validateRequest(getJadeSessionSchema),
  getJadeSessionController
);

askJadeRouter.delete(
  "/sessions/:sessionId",
  verifyJwtToken,
  validateRequest(deleteJadeSessionSchema),
  deleteJadeSessionController
);

export default askJadeRouter;
