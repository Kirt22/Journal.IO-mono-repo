import express, { Express } from "express";
import { apiResponse, API_MESSAGES } from "../helpers/commonHelper.helpers";
import adminRouter from "../services/admin/admin.routes";
import authRouter from "../services/auth/auth.routes";
import goalsRouter from "../services/goals/goals.routes";
import guidedReflectionRouter from "../services/guided-reflection/guided-reflection.routes";
import insightsRouter from "../services/insights/insights.routes";
import mindMapRouter from "../services/mindmap/mindmap.routes";
import askJadeRouter from "../services/ask-jade/askJade.routes";
import moodRouter from "../services/mood/mood.routes";
import onboardingRouter from "../services/onboarding/onboarding.routes";
import journalRouter from "../services/journal/journal.routes";
import privacyRouter from "../services/privacy/privacy.routes";
import promptsRouter from "../services/prompts/prompts.routes";
import remindersRouter from "../services/reminders/reminders.routes";
import streaksRouter from "../services/streaks/streaks.routes";
import userRouter from "../services/user/user.routes";
import paywallRouter from "../services/paywall/paywall.routes";
import revenueCatRouter from "../services/revenuecat/revenuecat.routes";
import widgetsRouter from "../services/widgets/widgets.routes";
import { registerLegalRoutes } from "./legal.routes";
import { unexpectedErrorHandler } from "../middleware/security.middleware";

console.log("Initializing routes...");

export const initializeRoutes = (app: Express): void => {
  // **Global API Prefix Setup**
  const apiRouter = express.Router();

  registerLegalRoutes(app);

  // Routes
  apiRouter.use("/auth", authRouter);
  apiRouter.use("/admin", adminRouter);
  apiRouter.use("/goals", goalsRouter);
  apiRouter.use("/guided-reflection", guidedReflectionRouter);
  apiRouter.use("/users", userRouter);
  apiRouter.use("/mood", moodRouter);
  apiRouter.use("/onboarding", onboardingRouter);
  apiRouter.use("/journal", journalRouter);
  apiRouter.use("/privacy", privacyRouter);
  apiRouter.use("/prompts", promptsRouter);
  apiRouter.use("/reminders", remindersRouter);
  apiRouter.use("/streaks", streaksRouter);
  apiRouter.use("/insights", insightsRouter);
  apiRouter.use("/mind-map", mindMapRouter);
  apiRouter.use("/ask-jade", askJadeRouter);
  apiRouter.use("/paywall", paywallRouter);
  apiRouter.use("/webhooks", revenueCatRouter);
  apiRouter.use("/widgets", widgetsRouter);

  // Attach the global prefix
  app.use("/api/v1", apiRouter);

  // 404 Handler for unknown routes
  app.use((_req, res) => {
    res.status(404).json(apiResponse(false, API_MESSAGES.routeNotFound, {}));
  });

  app.use(unexpectedErrorHandler);
};
