import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

const SALES_API_URL = process.env.SALES_API_URL || "https://sales-ai-api-468526005573.asia-south1.run.app";

export async function POST(request: NextRequest) {
  try {
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

    // Parse body
    const body = await request.json();

    // Call API
    const response = await fetch(
      `${SALES_API_URL}/api/v1/admin/workspaces/${workspaceId}/provider-credentials`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-access-token": session.access_token
        },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Provider credentials proxy error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
