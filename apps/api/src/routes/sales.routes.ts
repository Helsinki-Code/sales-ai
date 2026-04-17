import { Router } from "express";
import { randomUUID } from "node:crypto";
import { asyncSalesEndpoints, executeSkill, type SalesEndpoint } from "@sales-ai/shared";
import { requireApiKeyOrOAuth } from "../middleware/api-or-oauth-auth.middleware.js";
import { apiRateLimitMiddleware } from "../middleware/rate-limit.middleware.js";
import { redis } from "../lib/redis.js";
import { salesBodySchemaByEndpoint, endpointEnum } from "../schemas/sales.schemas.js";
import { getAnthropicApiKey } from "../services/provider-credentials.service.js";
import { resolveModelForEndpoint } from "../services/model-policy.service.js";
import { createJobRecord, findJobByIdempotency } from "../services/jobs.service.js";
import { salesQueue } from "../jobs/queue.js";
import { recordUsageEvent } from "../services/usage.service.js";

export const salesRouter = Router();

salesRouter.post("/:endpoint", requireApiKeyOrOAuth("sales:run"), apiRateLimitMiddleware, async (req, res, next) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    }

    const endpoint = endpointEnum.parse(req.params.endpoint) as SalesEndpoint;
    const schema = salesBodySchemaByEndpoint[endpoint];
    const parsedBody = schema.parse(req.body);
    const requestedModel = typeof req.body?.model === "string" ? req.body.model : undefined;

    const model = await resolveModelForEndpoint(req.auth.workspaceId, endpoint, requestedModel);

    if (asyncSalesEndpoints.includes(endpoint)) {
      const idempotencyKey = req.header("idempotency-key");
      if (!idempotencyKey) {
        return res.status(400).json({
          success: false,
          error: { code: "MISSING_IDEMPOTENCY_KEY", message: "Idempotency-Key header is required for async endpoints." }
        });
      }

      const existing = await findJobByIdempotency(req.auth.workspaceId, endpoint, idempotencyKey);
      if (existing) {
        return res.status(202).json({
          success: true,
          jobId: existing.id,
          status: existing.status,
          pollUrl: `/api/v1/jobs/${existing.id}`
        });
      }

      const jobId = await createJobRecord({
        orgId: req.auth.orgId,
        workspaceId: req.auth.workspaceId,
        apiKeyId: req.auth.apiKeyId,
        endpoint,
        payload: parsedBody,
        idempotencyKey,
        requestId: req.requestId
      });

      await salesQueue.add(
        "sales-job",
        {
          jobId,
          orgId: req.auth.orgId,
          workspaceId: req.auth.workspaceId,
          apiKeyId: req.auth.apiKeyId,
          endpoint,
          input: parsedBody,
          requestedModel: model,
          requestId: req.requestId
        },
        { jobId }
      );

      return res.status(202).json({
        success: true,
        jobId,
        status: "queued",
        pollUrl: `/api/v1/jobs/${jobId}`
      });
    }

    const anthropicApiKey = await getAnthropicApiKey(req.auth.workspaceId);
    const result = await executeSkill({
      endpoint,
      userInput: parsedBody,
      apiKey: anthropicApiKey,
      model,
      redis
    });

    await recordUsageEvent({
      orgId: req.auth.orgId,
      workspaceId: req.auth.workspaceId,
      apiKeyId: req.auth.apiKeyId,
      endpoint,
      model: result.model,
      tokens: result.tokens,
      durationMs: result.durationMs,
      requestId: req.requestId,
      status: "success"
    });

    return res.json({
      success: true,
      data: result.data,
      meta: {
        requestId: req.requestId,
        durationMs: result.durationMs,
        model: result.model,
        tokensUsed: result.tokens,
        traceId: randomUUID()
      }
    });
  } catch (error) {
    return next(error);
  }
});
