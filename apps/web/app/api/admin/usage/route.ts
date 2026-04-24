import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";

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

    const { workspaceId, orgId } = await getWorkspaceContext(user.id);

    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");

    let query = supabase
      .from("usage_daily_rollups")
      .select("usage_date,endpoint,model,request_count,success_count,failure_count,input_tokens,output_tokens,cost_usd,token_cost_usd,managed_estimated_cost_usd,total_cost_usd,parallel_api_calls,parallel_enrichment_runs,managed_crawler_runs,managed_pages_crawled,managed_verification_runs,managed_cycle_count,standard_units_consumed,lead_units_consumed")
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

    const sanitized = (data ?? []).map((row: Record<string, unknown>) => {
      const model = typeof row.model === "string" ? row.model.replace(/parallel/gi, "managed") : row.model;
      return {
        ...row,
        model,
        managed_crawler_runs:
          typeof row.managed_crawler_runs === "number" ? row.managed_crawler_runs : row.parallel_api_calls ?? 0,
        managed_verification_runs:
          typeof row.managed_verification_runs === "number"
            ? row.managed_verification_runs
            : row.parallel_enrichment_runs ?? 0
      };
    });

    const { data: unitWallet, error: unitWalletError } = await supabase
      .from("org_billing")
      .select("current_plan_key,cycle_start_at,cycle_end_at,included_standard_units,included_lead_units,purchased_standard_units,purchased_lead_units,consumed_standard_units,consumed_lead_units")
      .eq("org_id", orgId)
      .maybeSingle();
    if (unitWalletError) {
      throw new Error(`Failed to load unit wallet: ${unitWalletError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: sanitized,
      units: {
        current_plan_key: unitWallet?.current_plan_key ?? null,
        cycle_start_at: unitWallet?.cycle_start_at ?? null,
        cycle_end_at: unitWallet?.cycle_end_at ?? null,
        included_standard_units: unitWallet?.included_standard_units ?? 0,
        included_lead_units: unitWallet?.included_lead_units ?? 0,
        purchased_standard_units: unitWallet?.purchased_standard_units ?? 0,
        purchased_lead_units: unitWallet?.purchased_lead_units ?? 0,
        consumed_standard_units: unitWallet?.consumed_standard_units ?? 0,
        consumed_lead_units: unitWallet?.consumed_lead_units ?? 0
      }
    });
  } catch (error) {
    console.error("Usage GET proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
