import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

interface ModelPolicyInput {
  endpoint: string;
  defaultModel: string;
  allowedModels: string[];
}

function normalizePolicies(input: unknown): ModelPolicyInput[] {
  const rows: ModelPolicyInput[] = [];
  if (!input || typeof input !== "object") return rows;

  if (Array.isArray(input)) {
    for (const item of input) {
      if (!item || typeof item !== "object") continue;
      const rawEndpoint = typeof (item as any).endpoint === "string" ? (item as any).endpoint.trim() : "";
      const rawDefaultModel = typeof (item as any).defaultModel === "string" ? (item as any).defaultModel.trim() : "";
      const allowedInput = Array.isArray((item as any).allowedModels) ? (item as any).allowedModels : [];
      const rawAllowed = allowedInput
        .filter((v: unknown): v is string => typeof v === "string")
        .map((v: string) => v.trim())
        .filter(Boolean);
      if (!rawEndpoint) continue;
      if (!rawDefaultModel && rawAllowed.length === 0) continue;
      const defaultModel = rawDefaultModel || rawAllowed[0];
      const allowedModels = rawAllowed.length > 0 ? rawAllowed : [defaultModel];
      rows.push({ endpoint: rawEndpoint, defaultModel, allowedModels });
    }
    return rows;
  }

  for (const [endpointKey, value] of Object.entries(input as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const endpoint = endpointKey.trim();
    if (!endpoint) continue;

    const rawDefaultModel = typeof (value as any).defaultModel === "string" ? (value as any).defaultModel.trim() : "";
    const rawAllowedInput = (value as any).allowedModels;
    const rawAllowed = Array.isArray(rawAllowedInput)
      ? rawAllowedInput
          .filter((v: unknown): v is string => typeof v === "string")
          .map((v: string) => v.trim())
          .filter(Boolean)
      : typeof rawAllowedInput === "string"
        ? rawAllowedInput.split(",").map((v: string) => v.trim()).filter(Boolean)
        : [];

    if (!rawDefaultModel && rawAllowed.length === 0) continue;
    const defaultModel = rawDefaultModel || rawAllowed[0];
    const allowedModels = rawAllowed.length > 0 ? rawAllowed : [defaultModel];
    rows.push({ endpoint, defaultModel, allowedModels });
  }

  return rows;
}

export async function GET() {
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

    const { data, error } = await supabase
      .from("workspace_model_policies")
      .select("endpoint,default_model,allowed_models")
      .eq("workspace_id", workspaceId);

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

    const policies = Object.fromEntries(
      (data ?? []).map((row: { endpoint: string; default_model: string; allowed_models: unknown }) => [
        row.endpoint,
        {
          defaultModel: row.default_model,
          allowedModels: Array.isArray(row.allowed_models) ? row.allowed_models : []
        }
      ])
    );

    return NextResponse.json({ success: true, policies });
  } catch (error) {
    console.error("Model policies GET proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const body = await request.json();
    const policies = normalizePolicies(body?.policies);

    const { data: workspaceRow, error: workspaceError } = await supabase
      .from("workspaces")
      .select("org_id")
      .eq("id", workspaceId)
      .maybeSingle();

    if (workspaceError || !workspaceRow?.org_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "WORKSPACE_RESOLVE_FAILED",
            message: workspaceError?.message || "Workspace not found"
          }
        },
        { status: 500 }
      );
    }

    const { error: deleteError } = await supabase
      .from("workspace_model_policies")
      .delete()
      .eq("workspace_id", workspaceId);

    if (deleteError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DB_ERROR",
            message: deleteError.message
          }
        },
        { status: 500 }
      );
    }

    if (policies.length > 0) {
      const rows = policies.map((policy) => ({
        org_id: workspaceRow.org_id,
        workspace_id: workspaceId,
        endpoint: policy.endpoint,
        default_model: policy.defaultModel,
        allowed_models: policy.allowedModels,
        updated_by: user.id
      }));

      const { error: upsertError } = await supabase
        .from("workspace_model_policies")
        .upsert(rows, { onConflict: "workspace_id,endpoint" });

      if (upsertError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "DB_ERROR",
              message: upsertError.message
            }
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: { workspaceId, updated: policies.length }
    });
  } catch (error) {
    console.error("Model policies PUT proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
