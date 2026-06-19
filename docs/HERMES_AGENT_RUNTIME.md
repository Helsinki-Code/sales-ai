# Hermes Sales Agent Runtime

Sales AI keeps its API, queue, billing, Supabase tenancy, and job lifecycle. Hermes is an internal execution service selected with `AGENT_ENGINE=hermes`; `legacy` remains the default rollback path.

## Deployment

Deploy `apps/hermes-runner` from `apps/hermes-runner/Dockerfile` with:

- `HERMES_RUNNER_TOKEN`: a randomly generated secret of at least 32 characters.
- A read-only web-search provider credential supported by Hermes, such as `TAVILY_API_KEY`.
- No host filesystem mounts, Docker socket, CRM, email, calendar, or messaging credentials.

Configure API and worker with the same values:

```text
AGENT_ENGINE=hermes
HERMES_RUNNER_URL=https://internal-hermes-runner.example
HERMES_RUNNER_TOKEN=...
HERMES_ENDPOINTS=leads,prospect,research
HERMES_MAX_ITERATIONS=18
HERMES_MAX_TOKENS=8192
```

Use `HERMES_ENDPOINTS` to canary specific endpoint workflows. `*` enables all endpoints. The runner executes only Hermes `web` and `delegation` toolsets, explicitly disables terminal/file/browser-control/messaging/cron/memory/code-execution toolsets, and creates no persistent Hermes profile or session memory.

## Data and safety

Run `supabase/migrations/20260619_hermes_agent_runtime.sql` after existing migrations. It adds agent-run/task/tool/artifact audit tables, curated workspace memory, and the provider-policy columns already expected by the API and worker.

The worker streams runner events into `job_events`, records redacted audit metadata, and persists final results as `agent_artifacts`. Cancelling a Sales AI job forwards an interrupt to the active Hermes run. Provider keys are passed only over the authenticated internal request, kept in runner memory for the call, and are never included in events or persisted artifacts.

Hermes is integrated at revision `3485bc72251993ff7fb4d31bb03a64e836901415` under its MIT license; see `apps/hermes-runner/NOTICE.md`.
