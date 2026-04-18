import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { getEnv } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { healthRouter } from "./routes/health.routes.js";
import { salesRouter } from "./routes/sales.routes.js";
import { jobsRouter } from "./routes/jobs.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { openApiSpec } from "./openapi/spec.js";

const env = getEnv();

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(requestIdMiddleware);
app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - started;
    const payload = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs
    };
    if (res.statusCode >= 500) {
      logger.error(payload, "request completed");
      return;
    }
    if (res.statusCode >= 400) {
      logger.warn(payload, "request completed");
      return;
    }
    logger.info(payload, "request completed");
  });
  next();
});

app.use("/api/v1", healthRouter);
app.use("/api/v1/sales", salesRouter);
app.use("/api/v1/jobs", jobsRouter);
app.use("/api/v1/admin", adminRouter);

app.get("/api/v1/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});
app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use(errorHandler);

app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, "Sales AI API listening");
});
