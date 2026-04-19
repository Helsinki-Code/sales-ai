import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";

export async function DELETE(
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

    const { workspaceId } = await getWorkspaceContext(session.user.id);

    const { error } = await supabase
      .from("api_keys")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("id", apiKeyId);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DB_ERROR",
            message: error.message
          }
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        apiKeyId,
        status: "revoked"
      }
    });
  } catch (error) {
    console.error("API key DELETE proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
