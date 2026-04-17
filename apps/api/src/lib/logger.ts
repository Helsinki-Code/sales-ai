import pino from "pino";

export const logger = pino({
  name: "sales-ai-api",
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.x-api-key",
      "*.apiKey",
      "*.provider_api_key_encrypted"
    ],
    remove: true
  }
});