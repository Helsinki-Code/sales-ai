const salesPaths = [
  "quick",
  "research",
  "qualify",
  "contacts",
  "outreach",
  "followup",
  "prep",
  "proposal",
  "objections",
  "icp",
  "competitors",
  "prospect",
  "leads",
  "report",
  "report-pdf"
];

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Sales AI API",
    version: "1.0.0",
    description: "Multi-tenant Sales AI REST API with strict BYOK Anthropic model execution."
  },
  servers: [{ url: "https://api.sales-ai.app" }],
  components: {
    securitySchemes: {
      ApiKeyBearer: {
        type: "http",
        scheme: "bearer"
      },
      OAuthBearer: {
        type: "http",
        scheme: "bearer"
      }
    }
  },
  paths: {
    ...Object.fromEntries(
      salesPaths.map((path) => [
      `/api/v1/sales/${path}`,
      {
        post: {
          security: [{ ApiKeyBearer: [] }, { OAuthBearer: [] }],
          summary: `Run sales ${path} endpoint`,
          parameters: [
            {
              name: "x-workspace-id",
              in: "header",
              required: false,
              schema: { type: "string", format: "uuid" },
              description: "Required when using OAuth bearer token instead of app API key."
            }
          ],
          responses: {
            "200": { description: "Sync response" },
            "202": { description: "Async job accepted" },
            "400": { description: "Validation error" },
            "401": { description: "Unauthorized" }
          }
        }
      }
      ])
    ),
    "/api/v1/jobs/{jobId}": {
      get: {
        security: [{ ApiKeyBearer: [] }, { OAuthBearer: [] }],
        summary: "Get job status",
        parameters: [
          {
            name: "x-workspace-id",
            in: "header",
            required: false,
            schema: { type: "string", format: "uuid" },
            description: "Required when using OAuth bearer token instead of app API key."
          }
        ]
      },
      delete: {
        security: [{ ApiKeyBearer: [] }, { OAuthBearer: [] }],
        summary: "Cancel job",
        parameters: [
          {
            name: "x-workspace-id",
            in: "header",
            required: false,
            schema: { type: "string", format: "uuid" },
            description: "Required when using OAuth bearer token instead of app API key."
          }
        ]
      }
    },
    "/api/v1/admin/workspaces/{workspaceId}/api-keys": {
      get: { summary: "List API keys (dashboard auth)" },
      post: { summary: "Create API key (dashboard auth)" }
    },
    "/api/v1/admin/workspaces/{workspaceId}/usage": {
      get: { summary: "Get usage rollups (dashboard auth)" }
    }
  }
};
