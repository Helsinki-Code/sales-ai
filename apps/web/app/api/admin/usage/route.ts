import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const workspaceId = await getWorkspaceId(user.id);

    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");

    let query = supabase
      .from("usage_daily_rollups")
      .select("usage_date,endpoint,model,request_count,success_count,failure_count,input_tokens,output_tokens,cost_usd")
      .eq("workspace_id", workspaceId)
      .order("usage_date", { ascending: false })
      .limit(180);

    if (from) {
      query = query.gte("usage_date", from);
    }
    if (to) {
      query = query.lte("usage_date", to);
    }

    const { data, error } = await query;
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

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error("Usage GET proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
