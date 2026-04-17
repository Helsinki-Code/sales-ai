import type { RequestHandler } from "express";
import { ZodSchema } from "zod";

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Request body failed validation",
          details: parsed.error.flatten()
        }
      });
    }
    req.body = parsed.data;
    return next();
  };
}