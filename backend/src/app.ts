import express, { Express, Request, Response } from "express";
import { initializeRoutes } from "./routes";
import {
  getMongoConnectionStateLabel,
  init_mongoDB,
  isMongoReady,
} from "./config/mongo.db.config";
import cors from "cors";
import "dotenv/config";

const DEFAULT_PORT = 3000;

export const createApp = (): Express => {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: "Service is healthy",
      data: {
        mongo: {
          ready: isMongoReady(),
          status: getMongoConnectionStateLabel(),
        },
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
      },
    });
  });

  app.get("/ready", (_req: Request, res: Response) => {
    const mongoReady = isMongoReady();

    res.status(mongoReady ? 200 : 503).json({
      success: mongoReady,
      message: mongoReady ? "Service is ready" : "Service is not ready",
      data: {
        mongo: {
          ready: mongoReady,
          status: getMongoConnectionStateLabel(),
        },
      },
    });
  });

  initializeRoutes(app);

  return app;
};

export const startServer = async (): Promise<void> => {
  await init_mongoDB();
  const app = createApp();
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  const host = process.env.HOST || "0.0.0.0";

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(port, host, () => {
      console.log(`✅ Server running on http://${host}:${port}`);
      resolve();
    });

    server.on("error", reject);
  });
};

if (require.main === module) {
  void startServer().catch(error => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  });
}
