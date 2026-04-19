import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/api/resolve-auth";

const SALES_API_URL = process.env.SALES_API_URL || "https://sales-ai-api-468526005573.asia-south1.run.app";

const SYNC_ENDPOINTS = ["quick", "research", "qualify", "contacts", "outreach", "followup", "prep", "proposal", "objections", "icp", "competitors"];
const ASYNC_ENDPOINTS = ["prospect", "leads", "report", "report-pdf"];
const ALL_ENDPOINTS = [...SYNC_ENDPOINTS, ...ASYNC_ENDPOINTS];

type UpstreamPayload = {
  success?: boolean;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

async function readUpstreamPayload(response: Response): Promise<{ payload: UpstreamPayload; raw: string }> {
  const raw = await response.text();
  if (!raw) return { payload: {}, raw: "" };

  try {
    return { payload: JSON.parse(raw) as UpstreamPayload, raw };
  } catch {
    return {
      payload: {
        success: false,
        error: {
          code: "UPSTREAM_NON_JSON",
          message: raw.slice(0, 800)
        }
      },
      raw
    };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string }> }
) {
  try {
    const { endpoint } = await params;

    // Validate endpoint
    if (!ALL_ENDPOINTS.includes(endpoint)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ENDPOINT", message: `Unknown endpoint: ${endpoint}` } },
        { status: 400 }
      );
    }

    // Resolve auth (API key or session)
    const auth = await resolveAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Build headers based on auth type
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (auth.type === "apikey") {
      headers["x-app-api-key"] = auth.token;
    } else {
      headers["x-supabase-access-token"] = auth.accessToken;
      headers["x-workspace-id"] = auth.workspaceId;
    }

    // Optional: allows server-side invoker auth passthrough if your upstream requires it.
    const upstreamBearer = process.env.SALES_API_BEARER_TOKEN?.trim();
    if (upstreamBearer) {
      headers["Authorization"] = upstreamBearer.toLowerCase().startsWith("bearer ")
        ? upstreamBearer
        : `Bearer ${upstreamBearer}`;
    }

    // For async endpoints, add Idempotency-Key if not present
    if (ASYNC_ENDPOINTS.includes(endpoint)) {
      headers["Idempotency-Key"] = request.headers.get("Idempotency-Key") || crypto.randomUUID();
    }

    // Call API
    const response = await fetch(`${SALES_API_URL}/api/v1/sales/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const { payload, raw } = await readUpstreamPayload(response);

    if (!response.ok) {
      if ((response.status === 401 || response.status === 403) && !payload.error?.code) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "UPSTREAM_AUTH_BLOCKED",
              message:
                "Upstream API rejected this request before app auth. If Cloud Run is private, allow unauthenticated invocations or configure SALES_API_BEARER_TOKEN on web.",
              details: raw.slice(0, 500)
            }
          },
          { status: 502 }
        );
      }

      return NextResponse.json(payload, { status: response.status });
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("Sales proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
