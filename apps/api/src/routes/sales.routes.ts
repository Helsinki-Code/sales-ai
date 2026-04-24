import { Router, type Response } from "express";
import { randomUUID } from "node:crypto";
import { asyncSalesEndpoints, executeSkill, llmProviders, type LlmProvider, type SalesEndpoint } from "@sales-ai/shared";
import { requireApiKeyOrOAuth } from "../middleware/api-or-oauth-auth.middleware.js";
import { apiRateLimitMiddleware } from "../middleware/rate-limit.middleware.js";
import { redis } from "../lib/redis.js";
import { salesBodySchemaByEndpoint, endpointEnum } from "../schemas/sales.schemas.js";
import { getProviderApiKey } from "../services/provider-credentials.service.js";
import { resolveModelForEndpoint } from "../services/model-policy.service.js";
import { createJobRecord, findJobByIdempotency } from "../services/jobs.service.js";
import { salesQueue } from "../jobs/queue.js";
import { recordUsageEvent } from "../services/usage.service.js";
import {
  BillingNotConfiguredError,
  InsufficientUnitsError,
  consumeUnitsForCompletion,
  ensureUnitsAvailableForRequest,
  reverseConsumedUnits
} from "../services/unit-billing.service.js";

export const salesRouter = Router();

function resolveBuyUnitsUrl(originHeader: string | undefined): string {
  const origin = originHeader?.trim();
  if (origin) {
    return `${origin.replace(/\/+$/, "")}/billing?intent=topup`;
  }

  const configured =
    process.env.BILLING_PORTAL_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL;

  if (configured && configured.trim().length > 0) {
    return `${configured.replace(/\/+$/, "")}/billing?intent=topup`;
  }

  return "/billing?intent=topup";
}

function insufficientUnitsResponse(
  res: Response,
  error: InsufficientUnitsError,
  originHeader: string | undefined
) {
  return res.status(402).json({
    success: false,
    error: {
      code: "INSUFFICIENT_UNITS",
      message: "Insufficient unit balance for this operation.",
      details: {
        remaining_standard_units: error.remaining.remainingStandardUnits,
        remaining_lead_units: error.remaining.remainingLeadUnits,
        required_standard_units: error.required.standardUnits,
        required_lead_units: error.required.leadUnits,
        next_cycle_at: error.remaining.nextCycleAt,
        buy_units_url: resolveBuyUnitsUrl(originHeader)
      }
    }
  });
}

salesRouter.post("/:endpoint", requireApiKeyOrOAuth("sales:run"), apiRateLimitMiddleware, async (req, res, next) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    }

    const endpoint = endpointEnum.parse(req.params.endpoint) as SalesEndpoint;
    const schema = salesBodySchemaByEndpoint[endpoint];
    const parsedBody = schema.parse(req.body);
    const requestedModel = typeof req.body?.model === "string" ? req.body.model : undefined;
    const requestedProviderRaw = typeof req.body?.provider === "string" ? req.body.provider.trim() : undefined;
    const requestedProvider =
      requestedProviderRaw && (llmProviders as readonly string[]).includes(requestedProviderRaw)
        ? (requestedProviderRaw as LlmProvider)
        : undefined;

    const resolvedPolicy = await resolveModelForEndpoint(
      req.auth.workspaceId,
      endpoint,
      requestedModel,
      requestedProvider
    );

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

      await ensureUnitsAvailableForRequest(req.auth.orgId, endpoint, parsedBody);

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
          requestedProvider: resolvedPolicy.provider,
          requestedModel: resolvedPolicy.model,
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

    await ensureUnitsAvailableForRequest(req.auth.orgId, endpoint, parsedBody);

    const providerApiKey = await getProviderApiKey(req.auth.workspaceId, resolvedPolicy.provider);
    const result = await executeSkill({
      endpoint,
      userInput: parsedBody,
      apiKey: providerApiKey,
      provider: resolvedPolicy.provider,
      model: resolvedPolicy.model,
      redis
    });

    const consumed = await consumeUnitsForCompletion({
      orgId: req.auth.orgId,
      workspaceId: req.auth.workspaceId,
      apiKeyId: req.auth.apiKeyId,
      endpoint,
      requestId: req.requestId,
      resultData: result.data,
      fallbackPayload: parsedBody,
      idempotencyKey: `sync:${req.requestId}:consume`,
      unitBasis: "sync_success"
    });

    try {
      await recordUsageEvent({
        orgId: req.auth.orgId,
        workspaceId: req.auth.workspaceId,
        apiKeyId: req.auth.apiKeyId,
        endpoint,
        model: `${resolvedPolicy.provider}:${result.model}`,
        tokens: result.tokens,
        durationMs: result.durationMs,
        requestId: req.requestId,
        status: "success",
        tokenCostUsd: 0,
        managedEstimatedCostUsd: 0,
        totalCostUsd: 0,
        managedCrawlerRuns: 0,
        managedPagesCrawled: 0,
        managedVerificationRuns: 0,
        managedCycleCount: 0,
        standardUnitsConsumed: consumed.standardUnits,
        leadUnitsConsumed: consumed.leadUnits
      });
    } catch (usageError) {
      await reverseConsumedUnits({
        orgId: req.auth.orgId,
        workspaceId: req.auth.workspaceId,
        apiKeyId: req.auth.apiKeyId,
        requestId: req.requestId,
        endpoint,
        consumed,
        unitBasis: "sync_success",
        idempotencyKey: `sync:${req.requestId}:reverse`,
        reason: "usage_event_insert_failed"
      });
      throw usageError;
    }

    return res.json({
      success: true,
      data: result.data,
      meta: {
        requestId: req.requestId,
        durationMs: result.durationMs,
        model: `${resolvedPolicy.provider}:${result.model}`,
        tokensUsed: result.tokens,
        traceId: randomUUID()
      }
    });
  } catch (error) {
    if (error instanceof InsufficientUnitsError) {
      return insufficientUnitsResponse(res, error, req.header("origin"));
    }

    if (error instanceof BillingNotConfiguredError) {
      return res.status(402).json({
        success: false,
        error: {
          code: "BILLING_REQUIRED",
          message: "Billing is not configured for this organization.",
          details: {
            buy_units_url: resolveBuyUnitsUrl(req.header("origin"))
          }
        }
      });
    }

    return next(error);
  }
});
