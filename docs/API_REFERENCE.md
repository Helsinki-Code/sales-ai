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
