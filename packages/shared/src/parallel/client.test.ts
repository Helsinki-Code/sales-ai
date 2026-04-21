import { describe, expect, it } from "vitest";
import { ParallelApiError, isRetryableParallelError } from "./client.js";

describe("parallel retry classifier", () => {
  it("treats rate limit errors as retryable", () => {
    const error = new ParallelApiError("Too many requests", "PARALLEL_RATE_LIMITED", 429, true);
    expect(isRetryableParallelError(error)).toBe(true);
  });

  it("treats auth errors as non-retryable", () => {
    const error = new ParallelApiError("Forbidden", "PARALLEL_AUTH_ERROR", 403, false);
    expect(isRetryableParallelError(error)).toBe(false);
  });

  it("treats generic network error text as retryable", () => {
    expect(isRetryableParallelError(new Error("Network fetch failed"))).toBe(true);
  });
});

