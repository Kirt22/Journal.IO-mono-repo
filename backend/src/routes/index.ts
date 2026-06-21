import express, { Express } from "express";
import { apiResponse, API_MESSAGES } from "../helpers/commonHelper.helpers";
import adminRouter from "../services/admin/admin.routes";
import authRouter from "../services/auth/auth.routes";
import insightsRouter from "../services/insights/insights.routes";
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
import { registerLegalRoutes } from "./legal.routes";

console.log("Initializing routes...");

export const initializeRoutes = (app: Express): void => {
  // Security middleware
  //   app.use(helmet()); // Adds security headers

  // Rate limiting (prevents brute-force attacks)
  // const limiter = rateLimit({
  //   windowMs: 15 * 60 * 1000, // 15 minutes
  //   max: 100, // Limit each IP to 100 requests per window
  //   message: {
  //     status: 401,
  //     message: "Too many requests, please try again later.",
  //   },
  // });

  //app.use(limiter); // Apply rate limiting globally

  // **Global API Prefix Setup**
  const apiRouter = express.Router();

  registerLegalRoutes(app);

  // Routes
  apiRouter.use("/auth", authRouter);
  apiRouter.use("/admin", adminRouter);
  apiRouter.use("/users", userRouter);
  apiRouter.use("/mood", moodRouter);
  apiRouter.use("/onboarding", onboardingRouter);
  apiRouter.use("/journal", journalRouter);
  apiRouter.use("/privacy", privacyRouter);
  apiRouter.use("/prompts", promptsRouter);
  apiRouter.use("/reminders", remindersRouter);
  apiRouter.use("/streaks", streaksRouter);
  apiRouter.use("/insights", insightsRouter);
  apiRouter.use("/paywall", paywallRouter);
  apiRouter.use("/webhooks", revenueCatRouter);

  // Attach the global prefix
  app.use("/api/v1", apiRouter);

  // 404 Handler for unknown routes
  app.use((_req, res) => {
    res.status(404).json(apiResponse(false, API_MESSAGES.routeNotFound, {}));
  });
};
