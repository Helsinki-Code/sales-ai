import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
type LlmProvider = "anthropic" | "openai" | "gemini";

const SUPPORTED_PROVIDERS = ["anthropic", "openai", "gemini"] as const;

interface ModelPolicyInput {
  endpoint: string;
  defaultProvider: LlmProvider;
  defaultModel: string;
  allowedProviders: LlmProvider[];
  allowedModels: string[];
}

function normalizeProvider(value: unknown): LlmProvider | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if ((SUPPORTED_PROVIDERS as readonly string[]).includes(trimmed)) {
    return trimmed as LlmProvider;
  }
  return null;
}

function normalizeProviderList(value: unknown): LlmProvider[] {
  if (!Array.isArray(value)) return [];
  const providers = value.map((item) => normalizeProvider(item)).filter((item): item is LlmProvider => item !== null);
  return Array.from(new Set(providers));
}

function normalizePolicies(input: unknown): ModelPolicyInput[] {
  const rows: ModelPolicyInput[] = [];
  if (!input || typeof input !== "object") return rows;

  const entries = Array.isArray(input)
    ? (input
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const endpoint = typeof (item as { endpoint?: unknown }).endpoint === "string"
            ? String((item as { endpoint?: unknown }).endpoint).trim()
            : "";
          const defaultProvider = normalizeProvider((item as { defaultProvider?: unknown }).defaultProvider) ?? "anthropic";
          const defaultModel = typeof (item as { defaultModel?: unknown }).defaultModel === "string"
            ? String((item as { defaultModel?: unknown }).defaultModel).trim()
            : "";
          const allowedProvidersRaw = normalizeProviderList((item as { allowedProviders?: unknown }).allowedProviders);
          const allowedModelsRaw = Array.isArray((item as { allowedModels?: unknown }).allowedModels)
            ? ((item as { allowedModels?: unknown }).allowedModels as unknown[])
                .filter((v): v is string => typeof v === "string")
                .map((v) => v.trim())
                .filter(Boolean)
            : [];
          if (!endpoint) return null;
          return { endpoint, defaultProvider, defaultModel, allowedProvidersRaw, allowedModelsRaw };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null))
    : Object.entries(input as Record<string, unknown>).map(([endpointKey, value]) => {
        if (!value || typeof value !== "object") return null;
        const endpoint = endpointKey.trim();
        if (!endpoint) return null;
        const defaultProvider = normalizeProvider((value as { defaultProvider?: unknown }).defaultProvider) ?? "anthropic";
        const defaultModel =
          typeof (value as { defaultModel?: unknown }).defaultModel === "string"
            ? String((value as { defaultModel?: unknown }).defaultModel).trim()
            : "";
        const allowedProvidersRaw = normalizeProviderList((value as { allowedProviders?: unknown }).allowedProviders);
        const allowedModelsRaw = Array.isArray((value as { allowedModels?: unknown }).allowedModels)
          ? ((value as { allowedModels?: unknown }).allowedModels as unknown[])
              .filter((v): v is string => typeof v === "string")
              .map((v) => v.trim())
              .filter(Boolean)
          : typeof (value as { allowedModels?: unknown }).allowedModels === "string"
            ? String((value as { allowedModels?: unknown }).allowedModels)
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
            : [];
        return { endpoint, defaultProvider, defaultModel, allowedProvidersRaw, allowedModelsRaw };
      }).filter((row): row is NonNullable<typeof row> => row !== null);

  for (const row of entries) {
    const allowedProviders = row.allowedProvidersRaw.length > 0 ? row.allowedProvidersRaw : [row.defaultProvider];
    if (!allowedProviders.includes(row.defaultProvider)) {
      allowedProviders.unshift(row.defaultProvider);
    }
    const defaultModel = row.defaultModel || "claude-sonnet-4-5";
    const allowedModels = row.allowedModelsRaw.length > 0 ? row.allowedModelsRaw : [defaultModel];
    rows.push({
      endpoint: row.endpoint,
      defaultProvider: row.defaultProvider,
      defaultModel,
      allowedProviders: Array.from(new Set(allowedProviders)),
      allowedModels: Array.from(new Set(allowedModels))
    });
  }

  return rows;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const workspaceId = await getWorkspaceId(user.id);

    const { data, error } = await supabase
      .from("workspace_model_policies")
      .select("endpoint,default_provider,default_model,allowed_providers,allowed_models")
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
      (data ?? []).map(
        (row: {
          endpoint: string;
          default_provider: string | null;
          default_model: string;
          allowed_providers: unknown;
          allowed_models: unknown;
        }) => [
          row.endpoint,
          {
            defaultProvider:
              normalizeProvider(row.default_provider) ?? "anthropic",
            defaultModel: row.default_model,
            allowedProviders: normalizeProviderList(row.allowed_providers),
            allowedModels: Array.isArray(row.allowed_models) ? row.allowed_models : []
          }
        ]
      )
    );

    return NextResponse.json({ success: true, policies });
  } catch (error) {
    console.error("Model policies GET proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

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
        default_provider: policy.defaultProvider,
        default_model: policy.defaultModel,
        allowed_providers: policy.allowedProviders,
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
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}
