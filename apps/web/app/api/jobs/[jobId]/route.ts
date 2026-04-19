import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/api/resolve-auth";

const SALES_API_URL = process.env.SALES_API_URL || "https://sales-ai-api-468526005573.asia-south1.run.app";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Resolve auth (API key or session)
    const auth = await resolveAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Build headers based on auth type
    const headers: Record<string, string> = {};

    if (auth.type === "apikey") {
      headers["x-app-api-key"] = auth.token;
    } else {
      headers["x-supabase-access-token"] = auth.accessToken;
      headers["x-workspace-id"] = auth.workspaceId;
    }

    const upstreamBearer = process.env.SALES_API_BEARER_TOKEN?.trim();
    if (upstreamBearer) {
      headers["Authorization"] = upstreamBearer.toLowerCase().startsWith("bearer ")
        ? upstreamBearer
        : `Bearer ${upstreamBearer}`;
    }

    // Call API
    const response = await fetch(`${SALES_API_URL}/api/v1/jobs/${jobId}`, {
      method: "GET",
      headers,
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

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Jobs GET proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Resolve auth (API key or session)
    const auth = await resolveAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Build headers based on auth type
    const headers: Record<string, string> = {};

    if (auth.type === "apikey") {
      headers["x-app-api-key"] = auth.token;
    } else {
      headers["x-supabase-access-token"] = auth.accessToken;
      headers["x-workspace-id"] = auth.workspaceId;
    }

    const upstreamBearer = process.env.SALES_API_BEARER_TOKEN?.trim();
    if (upstreamBearer) {
      headers["Authorization"] = upstreamBearer.toLowerCase().startsWith("bearer ")
        ? upstreamBearer
        : `Bearer ${upstreamBearer}`;
    }

    // Call API
    const response = await fetch(`${SALES_API_URL}/api/v1/jobs/${jobId}`, {
      method: "DELETE",
      headers,
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

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Jobs DELETE proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
