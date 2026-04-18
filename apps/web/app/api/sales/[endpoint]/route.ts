import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

const SALES_API_URL = process.env.SALES_API_URL || "https://sales-ai-api-468526005573.asia-south1.run.app";

const SYNC_ENDPOINTS = ["quick", "research", "qualify", "contacts", "outreach", "followup", "prep", "proposal", "objections", "icp", "competitors"];
const ASYNC_ENDPOINTS = ["prospect", "leads", "report", "report-pdf"];
const ALL_ENDPOINTS = [...SYNC_ENDPOINTS, ...ASYNC_ENDPOINTS];

export async function POST(
  request: NextRequest,
  { params }: { params: { endpoint: string } }
) {
  try {
    const endpoint = params.endpoint;

    // Validate endpoint
    if (!ALL_ENDPOINTS.includes(endpoint)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ENDPOINT", message: `Unknown endpoint: ${endpoint}` } },
        { status: 400 }
      );
    }

    // Get session
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Get workspace ID
    const workspaceId = await getWorkspaceId(session.user.id);

    // Parse request body
    const body = await request.json();

    // For async endpoints, add Idempotency-Key if not present
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-supabase-access-token": session.access_token,
      "x-workspace-id": workspaceId
    };

    if (ASYNC_ENDPOINTS.includes(endpoint)) {
      headers["Idempotency-Key"] = request.headers.get("Idempotency-Key") || crypto.randomUUID();
    }

    // Call API
    const response = await fetch(`${SALES_API_URL}/api/v1/sales/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Sales proxy error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
