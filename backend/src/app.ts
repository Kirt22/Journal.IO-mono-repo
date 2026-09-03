import express, { Express, Request, Response } from "express";
import path from "node:path";
import { initializeRoutes } from "./routes";
import {
  getMongoConnectionStateLabel,
  init_mongoDB,
  isMongoReady,
} from "./config/mongo.db.config";
import "dotenv/config";
import { passwordResetPageController } from "./services/auth/auth.controllers";
import { assertRevenueCatProductionConfiguration } from "./config/revenueCat.config";
import { startRevenueCatEntitlementReconciliationJob } from "./services/revenuecat/revenuecat.service";
import { assertFieldEncryptionReady } from "./helpers/fieldEncryption.helpers";
import { getDevelopmentPremiumAccessOverride } from "./helpers/premiumEntitlement.helpers";
import {
  corsMiddleware,
  globalApiRateLimit,
  requestIdMiddleware,
  securityHeadersMiddleware,
} from "./middleware/security.middleware";

const DEFAULT_PORT = 3000;

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

// Two local backends from two checkouts look identical over HTTP, and the one
// holding the port decides which .env is in effect. Reporting the checkout and
// the resolved Premium selector makes "which server am I actually talking to"
// a single curl instead of a process hunt. Never exposed in production.
const getDevelopmentDiagnostics = () =>
  process.env.NODE_ENV === "production"
    ? null
    : {
        projectRoot: PROJECT_ROOT,
        premiumAccessMode: getDevelopmentPremiumAccessOverride(),
      };

export const createApp = (): Express => {
  const app = express();

  app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);
  app.use(requestIdMiddleware);
  app.use(securityHeadersMiddleware);
  app.use(corsMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    "/assets",
    express.static(path.join(__dirname, "..", "public"), { maxAge: "7d" })
  );
  app.get("/reset-password", passwordResetPageController);

  app.get("/health", (_req: Request, res: Response) => {
    const devDiagnostics = getDevelopmentDiagnostics();

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
        releaseSha:
          process.env.RENDER_GIT_COMMIT?.trim() ||
          process.env.RELEASE_SHA?.trim() ||
          null,
        ...(devDiagnostics ? { dev: devDiagnostics } : {}),
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

  app.use("/api/v1", globalApiRateLimit);
  initializeRoutes(app);

  return app;
};

export const startServer = async (): Promise<void> => {
  assertRevenueCatProductionConfiguration();
  assertFieldEncryptionReady();
  await init_mongoDB();
  const app = createApp();
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  const host =
    process.env.HOST ||
    (process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost");

  await new Promise<void>((resolve, reject) => {
    let hasStarted = false;

    const server = app.listen(port, host, () => {
      hasStarted = true;

      console.log(`✅ Server running on http://${host}:${port}`);

      const devDiagnostics = getDevelopmentDiagnostics();

      if (devDiagnostics) {
        console.log(
          `   checkout: ${devDiagnostics.projectRoot}\n` +
            `   Premium access mode: ${devDiagnostics.premiumAccessMode} ` +
            `(DEV_PREMIUM_ACCESS_OVERRIDE)`
        );
      }

      resolve();
    });

    // A lost bind is the failure that looks most like success: the process stays
    // up, serves nothing, and leaves whatever already owns the port answering
    // the app. Name the conflict and the command that identifies the squatter.
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(
          `❌ Port ${port} is already in use, so this server never started.\n` +
            `   Another process is answering on ${port} and the app is talking to it.\n` +
            `   Find it with: lsof -nP -iTCP:${port} -sTCP:LISTEN`
        );
      }

      // The bind can fail *after* the listening callback has run: Node reports
      // "listening" optimistically and delivers EADDRINUSE a few milliseconds
      // later. By then this promise has resolved, startup has continued, and the
      // reconciliation timer is holding the event loop open -- so the process
      // stays up forever owning no socket, which is the silent failure this
      // guard exists to catch. Rejecting is only possible before that point.
      if (hasStarted) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
      }

      reject(error);
    });
  });

  startRevenueCatEntitlementReconciliationJob();
};

if (require.main === module) {
  void startServer().catch(error => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  });
}
