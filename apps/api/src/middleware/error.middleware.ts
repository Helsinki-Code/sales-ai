import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): Response {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Request validation failed",
        details: err.flatten()
      }
    });
  }

  const message = err instanceof Error ? err.message : "Unexpected server error";
  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message
    }
  });
}