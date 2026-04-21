import { Router } from "express";
import { requireApiKeyOrOAuth } from "../middleware/api-or-oauth-auth.middleware.js";
import { getJob, cancelJob } from "../services/jobs.service.js";
import { salesQueue } from "../jobs/queue.js";

export const jobsRouter = Router();

function getRequiredParam(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

jobsRouter.get("/:jobId", requireApiKeyOrOAuth("jobs:read"), async (req, res, next) => {
  try {
    if (!req.auth) return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    const jobId = getRequiredParam(req.params.jobId);
    if (!jobId) return res.status(400).json({ success: false, error: { code: "INVALID_JOB_ID", message: "jobId route param is required." } });

    const job = await getJob(jobId, req.auth.workspaceId);
    if (!job) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Job not found" } });
    }
    return res.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        stage: job.stage,
        stageMessage: job.stage_message,
        stageMetadata: job.stage_metadata,
        stageUpdatedAt: job.stage_updated_at,
        result: job.result_payload,
        error: job.error_message,
        createdAt: job.created_at,
        updatedAt: job.updated_at
      }
    });
  } catch (error) {
    return next(error);
  }
});

jobsRouter.delete("/:jobId", requireApiKeyOrOAuth("jobs:write"), async (req, res, next) => {
  try {
    if (!req.auth) return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    const jobId = getRequiredParam(req.params.jobId);
    if (!jobId) return res.status(400).json({ success: false, error: { code: "INVALID_JOB_ID", message: "jobId route param is required." } });

    await cancelJob(jobId, req.auth.workspaceId);
    await salesQueue.remove(jobId);
    return res.json({ success: true, data: { jobId, status: "cancelled" } });
  } catch (error) {
    return next(error);
  }
});
