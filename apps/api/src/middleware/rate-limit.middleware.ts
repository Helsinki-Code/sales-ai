import type { RequestHandler } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { getEnv } from "../config/env.js";

const env = getEnv();

export const apiRateLimitMiddleware: RequestHandler = rateLimit({
  windowMs: 60 * 1000,
  limit: env.DEFAULT_RATE_LIMIT_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.apiKeyId ?? ipKeyGenerator(req.ip ?? ""),
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Rate limit exceeded. Try again in a minute."
    }
  }
});
