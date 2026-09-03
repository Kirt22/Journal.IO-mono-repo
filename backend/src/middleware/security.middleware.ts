import { randomUUID } from "node:crypto";
import cors from "cors";
import {
  ErrorRequestHandler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import helmet from "helmet";
import { API_MESSAGES } from "../helpers/commonHelper.helpers";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

const DEFAULT_BROWSER_ORIGINS = [
  "https://journalio.app",
  "https://www.journalio.app",
];

const readPositiveInteger = (name: string, fallback: number): number => {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const errorResponse = (message: string, error: Record<string, unknown> = {}) => ({
  success: false,
  message,
  error,
});

const rateLimitHandler = (_req: Request, res: Response) =>
  res
    .status(429)
    .json(errorResponse("Too many requests. Please wait a moment and try again."));

const createLimiter = ({
  limit,
  windowMs,
  keyGenerator,
}: {
  limit: number;
  windowMs: number;
  keyGenerator?: (req: Request) => string;
}) =>
  rateLimit({
    windowMs,
    limit,
    legacyHeaders: false,
    standardHeaders: "draft-8",
    handler: rateLimitHandler,
    skip: req => req.method === "OPTIONS",
    ...(keyGenerator ? { keyGenerator } : {}),
  });

const authenticatedKey = (req: Request): string => {
  const userId = req.user?._id?.toString();
  return userId
    ? `user:${userId}`
    : `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
};

export const securityHeadersMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      upgradeInsecureRequests:
        process.env.NODE_ENV === "production" ? [] : null,
    },
  },
});

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id")?.trim();
  req.requestId =
    incoming && /^[A-Za-z0-9._-]{1,128}$/.test(incoming)
      ? incoming
      : randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  next();
};

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || process.env.NODE_ENV !== "production") {
      callback(null, true);
      return;
    }

    const configured = process.env.CORS_ALLOWED_ORIGINS?.split(",")
      .map(value => value.trim())
      .filter(Boolean);
    const allowedOrigins = configured?.length
      ? configured
      : DEFAULT_BROWSER_ORIGINS;

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    const error = new Error("Origin is not allowed by CORS.") as Error & {
      status?: number;
    };
    error.status = 403;
    callback(error);
  },
  optionsSuccessStatus: 204,
});

export const globalApiRateLimit = createLimiter({
  limit: readPositiveInteger("GLOBAL_RATE_LIMIT_MAX", 600),
  windowMs: 15 * 60 * 1000,
});

export const authInitiationRateLimit = createLimiter({
  limit: readPositiveInteger("AUTH_RATE_LIMIT_MAX", 20),
  windowMs: 15 * 60 * 1000,
});

export const otpVerificationRateLimit = createLimiter({
  limit: readPositiveInteger("OTP_RATE_LIMIT_MAX", 30),
  windowMs: 15 * 60 * 1000,
});

export const publicDemoRateLimit = createLimiter({
  limit: readPositiveInteger("PUBLIC_DEMO_RATE_LIMIT_MAX", 5),
  windowMs: 60 * 60 * 1000,
});

export const authenticatedAiRateLimit = createLimiter({
  limit: readPositiveInteger("AI_RATE_LIMIT_MAX", 60),
  windowMs: 60 * 60 * 1000,
  keyGenerator: authenticatedKey,
});

export const unexpectedErrorHandler: ErrorRequestHandler = (
  error: Error & { status?: number },
  req,
  res,
  _next: NextFunction
) => {
  const status =
    Number.isInteger(error.status) && (error.status ?? 500) >= 400
      ? error.status ?? 500
      : 500;

  if (status >= 500) {
    console.error("Unexpected request failure", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      errorName: error.name,
      errorMessage: error.message,
    });
  }

  res
    .status(status)
    .json(
      errorResponse(
        status === 403
          ? "This request origin is not allowed."
          : API_MESSAGES.internalError,
        { requestId: req.requestId }
      )
    );
};
