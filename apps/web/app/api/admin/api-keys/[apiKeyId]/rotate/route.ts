import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

const SALES_API_URL = process.env.SALES_API_URL || "https://sales-ai-api-468526005573.asia-south1.run.app";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ apiKeyId: string }> }
) {
  try {
    const { apiKeyId } = await params;
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const workspaceId = await getWorkspaceId(session.user.id);

    const response = await fetch(
      `${SALES_API_URL}/api/v1/admin/workspaces/${workspaceId}/api-keys/${apiKeyId}/rotate`,
      {
        method: "POST",
        headers: {
          "x-supabase-access-token": session.access_token
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("API key rotate proxy error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
