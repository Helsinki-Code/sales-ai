import { Queue } from "bullmq";
import { getEnv } from "../config/env.js";
import { redis } from "../lib/redis.js";

const env = getEnv();
export const SALES_QUEUE_NAME = "sales-jobs";

export const salesQueue = new Queue(SALES_QUEUE_NAME, {
  connection: redis,
  prefix: env.BULLMQ_PREFIX,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000
    }
  }
});

export type SalesJobPayload = {
  jobId: string;
  orgId: string;
  workspaceId: string;
  apiKeyId?: string;
  endpoint: string;
  input: Record<string, unknown>;
  requestedModel?: string;
  requestId: string;
};