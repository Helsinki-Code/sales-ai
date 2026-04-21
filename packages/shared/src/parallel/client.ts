import { z } from "zod";

const parallelRunStatusSchema = z.object({
  status: z.enum(["queued", "running", "completed", "failed", "cancelling", "cancelled"]),
  is_active: z.boolean().optional(),
  metrics: z
    .object({
      generated_candidates_count: z.number().optional(),
      matched_candidates_count: z.number().optional()
    })
    .partial()
    .optional()
});

const parallelFindAllCandidateSchema = z.object({
  candidate_id: z.string(),
  name: z.string().optional().default(""),
  url: z.string().optional().default(""),
  description: z.string().optional().default(""),
  match_status: z.enum(["generated", "matched", "unmatched"]),
  output: z.record(z.unknown()).optional().default({}),
  basis: z.array(z.unknown()).optional().default([])
});

const parallelFindAllRunSchema = z.object({
  findall_id: z.string(),
  status: parallelRunStatusSchema,
  generator: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().optional(),
  modified_at: z.string().optional()
});

const parallelFindAllResultSchema = z.object({
  findall_id: z.string(),
  status: parallelRunStatusSchema,
  candidates: z.array(parallelFindAllCandidateSchema).default([])
});

const parallelTaskRunCreateSchema = z.object({
  run_id: z.string(),
  status: z.enum(["queued", "action_required", "running", "completed", "failed", "cancelling", "cancelled"]),
  is_active: z.boolean(),
  processor: z.string().optional()
});

const parallelTaskRunResultSchema = z.object({
  run: z.object({
    run_id: z.string(),
    status: z.enum(["queued", "action_required", "running", "completed", "failed", "cancelling", "cancelled"]),
    is_active: z.boolean(),
    processor: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    error: z
      .object({
        message: z.string().optional()
      })
      .optional()
  }),
  output: z.object({
    type: z.enum(["json", "text"]).optional(),
    content: z.unknown(),
    basis: z.array(z.unknown()).optional()
  })
});

const findAllIngestResponseSchema = z.object({
  objective: z.string(),
  entity_type: z.string(),
  match_conditions: z
    .array(
      z.object({
        name: z.string(),
        description: z.string()
      })
    )
    .default([])
});

export type ParallelFindAllRun = z.infer<typeof parallelFindAllRunSchema>;
export type ParallelFindAllResult = z.infer<typeof parallelFindAllResultSchema>;
export type ParallelFindAllCandidate = z.infer<typeof parallelFindAllCandidateSchema>;
export type ParallelTaskRunCreateResponse = z.infer<typeof parallelTaskRunCreateSchema>;
export type ParallelTaskRunResultResponse = z.infer<typeof parallelTaskRunResultSchema>;
export type ParallelFindAllIngestResponse = z.infer<typeof findAllIngestResponseSchema>;

type FindAllRunRequest = {
  objective: string;
  entity_type: string;
  match_conditions: Array<{ name: string; description: string }>;
  generator: string;
  match_limit: number;
  metadata?: Record<string, string>;
};

type TaskRunRequest = {
  input: unknown;
  processor: string;
  task_spec: {
    output_schema: {
      type: "json";
      json_schema: Record<string, unknown>;
    };
  };
  metadata?: Record<string, string>;
};

export class ParallelApiError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "PARALLEL_AUTH_ERROR"
      | "PARALLEL_RATE_LIMITED"
      | "PARALLEL_TIMEOUT"
      | "PARALLEL_SCHEMA_INVALID"
      | "PARALLEL_UPSTREAM_ERROR",
    public readonly status?: number,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "ParallelApiError";
  }
}

function mapStatusToError(status: number, message: string): ParallelApiError {
  if (status === 401 || status === 403) {
    return new ParallelApiError(message, "PARALLEL_AUTH_ERROR", status, false);
  }
  if (status === 429) {
    return new ParallelApiError(message, "PARALLEL_RATE_LIMITED", status, true);
  }
  if (status >= 500) {
    return new ParallelApiError(message, "PARALLEL_UPSTREAM_ERROR", status, true);
  }
  return new ParallelApiError(message, "PARALLEL_UPSTREAM_ERROR", status, false);
}

export function isRetryableParallelError(error: unknown): boolean {
  if (error instanceof ParallelApiError) return error.retryable;
  if (error instanceof Error && /timed out|network|fetch/i.test(error.message)) return true;
  return false;
}

export type ParallelClientConfig = {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  findAllBetaHeader: string;
};

export class ParallelClient {
  constructor(private readonly config: ParallelClientConfig) {}

  async ingestFindAll(objective: string): Promise<ParallelFindAllIngestResponse> {
    const payload = await this.requestJson("POST", "/v1beta/findall/ingest", { objective }, true);
    return findAllIngestResponseSchema.parse(payload);
  }

  async createFindAllRun(request: FindAllRunRequest): Promise<{ findall_id: string }> {
    const payload = await this.requestJson("POST", "/v1beta/findall/runs", request, true);
    const parsed = z.object({ findall_id: z.string() }).safeParse(payload);
    if (!parsed.success) {
      throw new ParallelApiError("Invalid create findall response schema.", "PARALLEL_SCHEMA_INVALID");
    }
    return parsed.data;
  }

  async retrieveFindAllRun(findallId: string): Promise<ParallelFindAllRun> {
    const payload = await this.requestJson("GET", `/v1beta/findall/runs/${findallId}`, undefined, true);
    const parsed = parallelFindAllRunSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ParallelApiError("Invalid findall run schema.", "PARALLEL_SCHEMA_INVALID");
    }
    return parsed.data;
  }

  async retrieveFindAllResult(findallId: string): Promise<ParallelFindAllResult> {
    const payload = await this.requestJson("GET", `/v1beta/findall/runs/${findallId}/result`, undefined, true);
    const parsed = parallelFindAllResultSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ParallelApiError("Invalid findall result schema.", "PARALLEL_SCHEMA_INVALID");
    }
    return parsed.data;
  }

  async createTaskRun(request: TaskRunRequest): Promise<ParallelTaskRunCreateResponse> {
    const payload = await this.requestJson("POST", "/v1/tasks/runs", request);
    const parsed = parallelTaskRunCreateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ParallelApiError("Invalid task run create schema.", "PARALLEL_SCHEMA_INVALID");
    }
    return parsed.data;
  }

  async retrieveTaskRunResult(runId: string, timeoutSeconds: number): Promise<ParallelTaskRunResultResponse> {
    const payload = await this.requestJson("GET", `/v1/tasks/runs/${runId}/result?timeout=${timeoutSeconds}`, undefined);
    const parsed = parallelTaskRunResultSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ParallelApiError("Invalid task run result schema.", "PARALLEL_SCHEMA_INVALID");
    }
    return parsed.data;
  }

  private async requestJson(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    useFindAllBeta = false
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const headers: Record<string, string> = {
        "x-api-key": this.config.apiKey,
        "content-type": "application/json"
      };
      if (useFindAllBeta) {
        headers["parallel-beta"] = this.config.findAllBetaHeader;
      }

      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      const text = await response.text();
      let payload: unknown = {};
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { raw: text };
        }
      }

      if (!response.ok) {
        const message =
          (typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof (payload as { error?: unknown }).error === "object" &&
            (payload as { error?: { message?: string } }).error?.message) ||
          (typeof payload === "object" &&
            payload !== null &&
            "message" in payload &&
            typeof (payload as { message?: unknown }).message === "string" &&
            (payload as { message: string }).message) ||
          `Parallel request failed: ${response.status}`;
        throw mapStatusToError(response.status, String(message));
      }

      return payload;
    } catch (error) {
      if (error instanceof ParallelApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ParallelApiError("Parallel request timed out.", "PARALLEL_TIMEOUT", undefined, true);
      }
      const message = error instanceof Error ? error.message : "Unknown network error";
      throw new ParallelApiError(message, "PARALLEL_UPSTREAM_ERROR", undefined, true);
    } finally {
      clearTimeout(timeout);
    }
  }
}

