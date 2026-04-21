# API Reference (v1)

Base URL: `https://api.sales-ai.app/api/v1`

## Auth
- API runtime endpoints: `Authorization: Bearer <app_api_key>`
- Dashboard/admin endpoints: Supabase user bearer JWT
- OAuth runtime option: `Authorization: Bearer <oauth_access_token>` + `x-workspace-id: <workspace_uuid>`

## Sales endpoints
`POST /sales/{quick|research|qualify|contacts|outreach|followup|prep|proposal|objections|icp|competitors|prospect|leads|report|report-pdf}`

### Sync endpoints
`quick, research, qualify, contacts, outreach, followup, prep, proposal, objections, icp, competitors`

### Async endpoints
`prospect, leads, report, report-pdf`
- Require `Idempotency-Key` header.
- Return `202` with `{ jobId, status, pollUrl }`.

## Jobs
- `GET /jobs/:jobId`
- `DELETE /jobs/:jobId`

`GET /jobs/:jobId` now includes stage diagnostics:
- `stageMessage`
- `stageMetadata`
- `stageUpdatedAt`

For completed `leads` jobs, `data.result` returns the enriched leads v2 array with provenance fields.

### `POST /sales/leads`
Async lead generation request body:

```json
{
  "url": "https://example.com",
  "count": 5
}
```

Leads v2 result item shape (from `GET /jobs/:jobId`):

```json
{
  "score": 88,
  "fit_reason": "High ICP fit with strong hiring and growth signals.",
  "company_name": "Example Inc",
  "contact_name": "Alex Smith",
  "contact_email": "alex.smith@example.com",
  "company_website": "https://example.com",
  "company_industry": "B2B SaaS",
  "company_location": "San Francisco, CA",
  "email_confidence": "pattern_derived",
  "recent_funding_flag": true,
  "recent_hiring_flag": true,
  "tech_stack_match_flag": true,
  "growth_signal_flag": true,
  "source_provider": "parallel",
  "source_run_id": "run_123",
  "enrichment_confidence": "high",
  "evidence": {
    "citationsCount": 4,
    "basisFields": ["company_size", "funding", "hiring"],
    "sources": ["https://..."],
    "summary": "Citations: 4, Fields: 3"
  },
  "score_breakdown": {
    "total": 88,
    "icp_fit": 34,
    "hiring": 18,
    "funding": 14,
    "tech_stack": 12,
    "growth": 10
  },
  "normalization_version": "leads_parallel_v2_2026_04_21"
}
```

## Admin
- `POST /admin/workspaces/:workspaceId/provider-credentials`
- `PUT /admin/workspaces/:workspaceId/model-policies`
- `GET /admin/workspaces/:workspaceId/api-keys`
- `POST /admin/workspaces/:workspaceId/api-keys`
- `POST /admin/workspaces/:workspaceId/api-keys/:apiKeyId/rotate`
- `DELETE /admin/workspaces/:workspaceId/api-keys/:apiKeyId`
- `GET /admin/workspaces/:workspaceId/usage?from=YYYY-MM-DD&to=YYYY-MM-DD`

OpenAPI: `/api/v1/openapi.json`
Swagger UI: `/api/v1/docs`
