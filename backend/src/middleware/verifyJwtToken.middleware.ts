import { NextFunction, Request, Response } from "express";
import { apiResponse } from "../helpers/commonHelper.helpers";
import jwt from "jsonwebtoken";
import { userModel } from "../schema/user.schema";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const verifyJwtToken = async (
  req: Request ,
  res: Response,
  next: NextFunction
) => {
  if (!req.headers.authorization) {
    return res
      .status(401)
      .json(apiResponse(false, "Unauthorized: No token provided", {}));
  }

  const jwtSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "";

  if (!jwtSecret) {
    console.error("JWT access secret is not configured.");
    return res
      .status(500)
      .json(apiResponse(false, "Server misconfiguration", {}));
  }

  try {
    const token = req.headers.authorization.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json(apiResponse(false, "Unauthorized: No token provided", {}));
    }

    const data = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    const userId = data.sub || data.userId;

    if (!userId) {
      return res
        .status(401)
        .json(apiResponse(false, "Unauthorized: Invalid token", {}));
    }

    const existingUser = await userModel.findById(userId);

    if (!existingUser) {
      return res
        .status(401)
        .json(apiResponse(false, "Unauthorized: User not found", {}));
    }

    req.user = existingUser;
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    return res
      .status(401)
      .json(apiResponse(false, "Unauthorized: Invalid token", {}));
  }
};
