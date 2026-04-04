import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  createReminderController,
  deleteReminderController,
  getRemindersController,
  updateReminderController,
} from "./reminders.controllers";
import {
  createReminderSchema,
  deleteReminderSchema,
  getRemindersSchema,
  updateReminderSchema,
} from "./reminders.validators";

const remindersRouter = Router();

remindersRouter.get(
  "/",
  verifyJwtToken,
  validateRequest(getRemindersSchema),
  getRemindersController
);

remindersRouter.post(
  "/",
  verifyJwtToken,
  validateRequest(createReminderSchema),
  createReminderController
);

remindersRouter.patch(
  "/:reminderId",
  verifyJwtToken,
  validateRequest(updateReminderSchema),
  updateReminderController
);

remindersRouter.delete(
  "/:reminderId",
  verifyJwtToken,
  validateRequest(deleteReminderSchema),
  deleteReminderController
);

export default remindersRouter;
