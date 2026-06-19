from __future__ import annotations

import json
import os
import queue
import re
import threading
import time
from collections.abc import Iterator
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from .contracts import RunRequest, RunResult, RunnerEvent
from .workflows import build_system_prompt, build_user_prompt

HERMES_REVISION = "3485bc72251993ff7fb4d31bb03a64e836901415"
RUNNER_TOKEN = os.getenv("HERMES_RUNNER_TOKEN", "")

app = FastAPI(title="Sales AI Hermes Runner", version="0.1.0")
_active_agents: dict[str, Any] = {}
_active_agents_lock = threading.Lock()


def _require_runner_token(value: str | None) -> None:
    if not RUNNER_TOKEN or value != RUNNER_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid internal runner credential")


def _provider_config(request: RunRequest) -> tuple[str, str, str]:
    if request.provider == "anthropic":
        return "anthropic", "https://api.anthropic.com", "anthropic_messages"
    if request.provider == "gemini":
        return "google", "https://generativelanguage.googleapis.com/v1beta/openai/", "chat_completions"
    return "openai", "https://api.openai.com/v1", "chat_completions"


def _json_from_response(value: str) -> Any:
    cleaned = value.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as first_error:
        match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", cleaned)
        if not match:
            raise ValueError("Hermes response did not contain valid JSON") from first_error
        return json.loads(match.group(1))


def _run_hermes(request: RunRequest, emit: callable) -> RunResult:
    # Imported inside the run so process startup stays cheap and tests can use
    # the endpoint contract without a configured model provider.
    from run_agent import AIAgent

    provider, base_url, api_mode = _provider_config(request)
    started = time.monotonic()
    tool_count = 0

    def tool_progress(event_type: str, tool_name: str | None = None, preview: str | None = None, args: Any = None, **kwargs: Any) -> None:
        nonlocal tool_count
        stage = "tool_completed" if "complete" in str(event_type) else "tool_started"
        if stage == "tool_started":
            tool_count += 1
        emit(RunnerEvent(
            type=event_type,
            stage=stage,
            progress=min(88, 25 + tool_count * 4),
            message=f"{tool_name or 'agent tool'} {stage.replace('_', ' ')}",
            metadata={"tool": tool_name, "preview": (preview or "")[:500], "delegation": kwargs},
        ))

    emit(RunnerEvent(type="run.started", stage="agent_started", progress=15, message="Hermes sales orchestrator started.", metadata={"engine_revision": HERMES_REVISION}))
    agent = AIAgent(
        api_key=request.provider_api_key.get_secret_value(),
        base_url=base_url,
        provider=provider,
        api_mode=api_mode,
        model=request.model,
        max_iterations=request.max_iterations,
        max_tokens=request.max_tokens,
        enabled_toolsets=["web"],
        disabled_toolsets=["terminal", "file", "browser", "messaging", "cron", "memory", "code_execution"],
        quiet_mode=True,
        ephemeral_system_prompt=build_system_prompt(request),
        skip_context_files=True,
        load_soul_identity=False,
        skip_memory=True,
        tool_progress_callback=tool_progress,
        platform="api",
        session_id=f"sales-job-{request.run_id}",
    )
    with _active_agents_lock:
        _active_agents[request.run_id] = agent
    timeout = threading.Timer(request.max_runtime_seconds, lambda: agent.interrupt("Sales AI runtime budget exceeded"))
    timeout.daemon = True
    timeout.start()
    try:
        raw = agent.chat(build_user_prompt(request))
    finally:
        timeout.cancel()
        with _active_agents_lock:
            _active_agents.pop(request.run_id, None)
    data = _json_from_response(raw)
    # Accept the common `{ "leads": [...] }` transport wrapper defensively.
    # The worker still validates every item against the product's V3 contract,
    # so this never turns an arbitrary research report into saved leads.
    if request.endpoint == "leads" and isinstance(data, dict) and isinstance(data.get("leads"), list):
        data = data["leads"]
    elapsed = int((time.monotonic() - started) * 1000)
    usage = getattr(agent, "last_usage", None) or {}
    token_usage = {key: int(value) for key, value in usage.items() if isinstance(value, (int, float))}
    return RunResult(
        data=data,
        raw_text=raw,
        model=request.model,
        provider=request.provider,
        duration_ms=elapsed,
        token_usage=token_usage,
        tool_call_count=tool_count,
    )


def _event_stream(request: RunRequest) -> Iterator[str]:
    events: queue.Queue[RunnerEvent | RunResult | Exception] = queue.Queue()

    def emit(event: RunnerEvent) -> None:
        events.put(event)

    def work() -> None:
        try:
            events.put(_run_hermes(request, emit))
        except Exception as error:  # surfaced as a final, safe event to the worker
            events.put(error)

    threading.Thread(target=work, name=f"hermes-{request.run_id}", daemon=True).start()
    while True:
        item = events.get()
        if isinstance(item, RunnerEvent):
            yield json.dumps({"kind": "event", **item.model_dump()}, separators=(",", ":")) + "\n"
            continue
        if isinstance(item, RunResult):
            yield json.dumps({"kind": "result", **item.model_dump()}, separators=(",", ":")) + "\n"
            return
        yield json.dumps({"kind": "error", "message": str(item)[:1000]}, separators=(",", ":")) + "\n"
        return


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"ok": True, "engine": "hermes", "engine_revision": HERMES_REVISION})


@app.post("/internal/v1/runs")
def run(request: RunRequest, x_hermes_runner_token: str | None = Header(default=None)) -> StreamingResponse:
    _require_runner_token(x_hermes_runner_token)
    return StreamingResponse(_event_stream(request), media_type="application/x-ndjson", headers={"cache-control": "no-store"})


@app.post("/internal/v1/runs/{run_id}/cancel")
def cancel(run_id: str, x_hermes_runner_token: str | None = Header(default=None)) -> JSONResponse:
    _require_runner_token(x_hermes_runner_token)
    with _active_agents_lock:
        agent = _active_agents.get(run_id)
    if agent is None:
        return JSONResponse({"ok": True, "status": "not_running"})
    agent.interrupt("Cancelled by Sales AI job request")
    return JSONResponse({"ok": True, "status": "cancelling"})
