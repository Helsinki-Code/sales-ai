"use client";

import { useEffect, useState } from "react";
import { ResultViewer } from "./result-viewer";

interface JobPollerProps {
  jobId: string;
  endpoint: string;
  onComplete: (result: any) => void;
}

export function JobPoller({ jobId, endpoint, onComplete }: JobPollerProps) {
  const [status, setStatus] = useState<string>("queued");
  const [progress, setProgress] = useState<number>(0);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [startTime] = useState<number>(Date.now());
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error?.message || "Failed to fetch job status");
          return;
        }

        const jobData = data.data;
        setStatus(jobData.status);
        setProgress(jobData.progress || 0);
        setStage(jobData.stage || "");

        if (jobData.status === "complete") {
          setResult(jobData.result);
          onComplete(jobData.result);
        } else if (jobData.status === "failed") {
          setError(jobData.error || "Job failed");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Polling error");
      }
    };

    // Poll immediately, then every 2 seconds
    poll();
    const interval = setInterval(poll, 2000);

    return () => clearInterval(interval);
  }, [jobId, onComplete]);

  const handleCancel = async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      if (res.ok) {
        setStatus("cancelled");
      }
    } catch (err) {
      console.error("Failed to cancel job:", err);
    }
  };

  if (result) {
    return <ResultViewer result={result} />;
  }

  const statusColor =
    status === "complete"
      ? "var(--mint)"
      : status === "failed"
        ? "var(--slate)"
        : status === "running"
          ? "var(--accent)"
          : "var(--panel)";

  return (
    <div className="card">
      <h3>Job Status</h3>

      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <span style={{ fontWeight: "500" }}>Job ID</span>
          <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{jobId.slice(0, 8)}...</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <span style={{ fontWeight: "500" }}>Status</span>
          <span
            style={{
              padding: "0.25rem 0.75rem",
              borderRadius: "4px",
              fontSize: "0.85rem",
              backgroundColor: statusColor,
              color: status === "complete" || status === "running" ? "var(--ink)" : "white"
            }}
          >
            {status}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
          <span style={{ fontWeight: "500" }}>Elapsed Time</span>
          <span>{Math.floor(elapsedTime / 60)}m {elapsedTime % 60}s</span>
        </div>

        {stage && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
            <span style={{ fontWeight: "500" }}>Current Stage</span>
            <span style={{ color: "var(--slate)" }}>{stage}</span>
          </div>
        )}

        {/* Progress Bar */}
        {progress > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: "8px", backgroundColor: "var(--panel)", borderRadius: "4px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  backgroundColor: "var(--accent)",
                  width: `${progress}%`,
                  transition: "width 0.3s ease"
                }}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "var(--slate)",
            color: "white",
            borderRadius: "4px",
            marginBottom: "1rem",
            fontSize: "0.9rem"
          }}
        >
          {error}
        </div>
      )}

      {["queued", "running"].includes(status) && (
        <button
          onClick={handleCancel}
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid var(--slate)",
            borderRadius: "4px",
            backgroundColor: "transparent",
            color: "var(--slate)",
            cursor: "pointer",
            fontSize: "0.9rem"
          }}
        >
          Cancel Job
        </button>
      )}

      {status === "complete" && (
        <div style={{ color: "var(--mint)", textAlign: "center", fontWeight: "500" }}>
          ✓ Complete! Loading results...
        </div>
      )}

      {status === "failed" && (
        <div style={{ color: "var(--slate)", textAlign: "center", fontWeight: "500" }}>
          ✗ Job failed
        </div>
      )}

      {status === "cancelled" && (
        <div style={{ color: "var(--slate)", textAlign: "center", fontWeight: "500" }}>
          ✗ Job cancelled
        </div>
      )}
    </div>
  );
}
