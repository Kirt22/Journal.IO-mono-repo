import { NextFunction, Request, Response } from "express";
import { apiResponse } from "../helpers/commonHelper.helpers";
import jwt from "jsonwebtoken";
import { userModel } from "../schema/user.schema";

export const verifyJwtToken = async (
  req: Request & { user?: any },
  res: Response,
  next: NextFunction
) => {
  if (!req.headers.authorization) {
    return res
      .status(401)
      .json(apiResponse(false, "Unauthorized: No token provided", {}));
  }

  const jwtSecret = process.env.JWT_SECRET || "";

  try {
    const token = req.headers.authorization.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json(apiResponse(false, "Unauthorized: No token provided", {}));
    }

    const data: any = jwt.verify(token, jwtSecret);
    const number = data.phone_no;

    // Check cache for user data

    const existingUser = await userModel.findOne({
      phone_no: number,
    });

    if (!existingUser) {
      return res
        .status(401)
        .json(apiResponse(false, "Unauthorized: User not found", {}));
    }

    // Set cache here

    req.user = existingUser;
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    return res
      .status(401)
      .json(apiResponse(false, "Unauthorized: Invalid token", {}));
  }
};
