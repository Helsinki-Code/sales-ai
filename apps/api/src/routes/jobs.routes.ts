import { Router } from "express";
import { requireApiKeyOrOAuth } from "../middleware/api-or-oauth-auth.middleware.js";
import { getJob, cancelJob } from "../services/jobs.service.js";
import { salesQueue } from "../jobs/queue.js";

export const jobsRouter = Router();

jobsRouter.get("/:jobId", requireApiKeyOrOAuth("jobs:read"), async (req, res, next) => {
  try {
    if (!req.auth) return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    const job = await getJob(req.params.jobId, req.auth.workspaceId);
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
    await cancelJob(req.params.jobId, req.auth.workspaceId);
    await salesQueue.remove(req.params.jobId);
    return res.json({ success: true, data: { jobId: req.params.jobId, status: "cancelled" } });
  } catch (error) {
    return next(error);
  }
});
