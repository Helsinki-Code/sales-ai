import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

const SALES_API_URL = process.env.SALES_API_URL || "https://sales-ai-api-468526005573.asia-south1.run.app";

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;

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

    // Call API
    const response = await fetch(`${SALES_API_URL}/api/v1/jobs/${jobId}`, {
      method: "GET",
      headers: {
        "x-supabase-access-token": session.access_token,
        "x-workspace-id": workspaceId
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Jobs GET proxy error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;

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

    // Call API
    const response = await fetch(`${SALES_API_URL}/api/v1/jobs/${jobId}`, {
      method: "DELETE",
      headers: {
        "x-supabase-access-token": session.access_token,
        "x-workspace-id": workspaceId
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Jobs DELETE proxy error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
