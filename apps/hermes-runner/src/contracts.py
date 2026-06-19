from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


class RunRequest(BaseModel):
    """The internal-only contract between the BullMQ worker and Hermes."""

    model_config = ConfigDict(extra="forbid")

    run_id: str
    job_id: str | None = None
    org_id: str
    workspace_id: str
    endpoint: str
    input: dict[str, Any]
    provider: Literal["anthropic", "openai", "gemini"]
    model: str = Field(min_length=1, max_length=200)
    provider_api_key: SecretStr
    max_iterations: int = Field(default=18, ge=1, le=36)
    max_tokens: int = Field(default=8192, ge=256, le=16384)
    max_runtime_seconds: int = Field(default=180, ge=30, le=600)
    max_delegation_depth: int = Field(default=2, ge=0, le=2)
    max_concurrent_children: int = Field(default=4, ge=1, le=6)
    enable_apify: bool = False

    @field_validator("endpoint")
    @classmethod
    def endpoint_is_safe(cls, value: str) -> str:
        if value not in {
            "quick", "research", "qualify", "contacts", "outreach", "followup",
            "prep", "proposal", "objections", "icp", "competitors", "prospect",
            "leads", "report", "report-pdf",
        }:
            raise ValueError("Unsupported sales endpoint")
        return value


class RunnerEvent(BaseModel):
    type: str
    stage: str
    progress: int = Field(ge=0, le=100)
    message: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class RunResult(BaseModel):
    data: Any
    raw_text: str
    model: str
    provider: str
    duration_ms: int
    token_usage: dict[str, int] = Field(default_factory=dict)
    tool_call_count: int = 0
