import express, { Express, Request, Response } from "express";
import { apiResponse } from "../helpers/commonHelper.helpers";
import userRouter from "../services/user/user.routes";
import journalRouter from "../services/journal/journal.routes";

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

  // Default route
  app.get("/", (req: Request, res: Response) => {
    res.send("🚀 Hello from TypeScript + Express!");
  });

  // Routes
  apiRouter.use("/user", userRouter);
  apiRouter.use("/journal", journalRouter);

  // Attach the global prefix
  app.use("/api/v1", apiRouter);

  // 404 Handler for unknown routes
  app.use((req: Request, res: Response): void => {
    res.status(404).json(apiResponse(false, "Route not found", {}));
  });
};
