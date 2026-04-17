import { Queue, Worker } from "bullmq";
import { getEnv } from "./config.js";
import { logger } from "./logger.js";
import { redis } from "./redis.js";
import { processSalesJob, handleSalesJobFailure, type SalesJobPayload } from "./processor.js";

const env = getEnv();
const queueName = "sales-jobs";

const dlq = new Queue<SalesJobPayload>(`${queueName}-dlq`, {
  connection: redis,
  prefix: env.BULLMQ_PREFIX
});

const worker = new Worker<SalesJobPayload>(
  queueName,
  async (job) => {
    await processSalesJob(job);
  },
  {
    connection: redis,
    prefix: env.BULLMQ_PREFIX,
    concurrency: env.WORKER_CONCURRENCY
  }
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Job completed");
});

worker.on("failed", async (job, err) => {
  await handleSalesJobFailure(job, err);

  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await dlq.add("dlq", job.data);
  }

  logger.error({ jobId: job?.id, err }, "Job failed");
});

logger.info("Worker started and awaiting jobs");