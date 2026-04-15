// src/middleware/validateRequest.middleware.ts
import { NextFunction, Request, Response } from "express";
import { ZodObject, ZodError, ZodIssue } from "zod";
import { apiResponse } from "../helpers/commonHelper.helpers";

export const validateRequest =
  (schema: ZodObject<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
    });

    if (!result.success) {
      const zodError = result.error as ZodError<any>;

      const formattedErrors = zodError.issues.map((err: ZodIssue) => ({
        path: err.path.join("."),
        message: err.message,
        code: err.code,
      }));

      return res
        .status(400)
        .json(
          apiResponse(
            false,
            "Validation failed",
            {},
            { errors: formattedErrors }
          )
        );
    }

    next();
  };
