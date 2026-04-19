import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { randomSecret, sha256 } from "@/lib/server-crypto";
import crypto from "node:crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ apiKeyId: string }> }
) {
  try {
    const { apiKeyId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { workspaceId, orgId } = await getWorkspaceContext(user.id);

    const { data: currentKey, error: currentKeyError } = await supabase
      .from("api_keys")
      .select("id,name,expires_at")
      .eq("workspace_id", workspaceId)
      .eq("id", apiKeyId)
      .maybeSingle();

    if (currentKeyError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DB_ERROR",
            message: currentKeyError.message
          }
        },
        { status: 500 }
      );
    }

    if (!currentKey) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "API key not found"
          }
        },
        { status: 404 }
      );
    }

    const { data: scopeRows, error: scopeError } = await supabase
      .from("api_key_scopes")
      .select("scope")
      .eq("api_key_id", apiKeyId);

    if (scopeError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DB_ERROR",
            message: scopeError.message
          }
        },
        { status: 500 }
      );
    }

    const scopes = (scopeRows ?? [])
      .map((row: { scope: unknown }) => row.scope)
      .filter((scope: unknown): scope is string => typeof scope === "string" && scope.length > 0);

    if (scopes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATE",
            message: "API key has no scopes to rotate"
          }
        },
        { status: 400 }
      );
    }

    const { error: revokeError } = await supabase
      .from("api_keys")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("id", apiKeyId);

    if (revokeError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DB_ERROR",
            message: revokeError.message
          }
        },
        { status: 500 }
      );
    }

    const newApiKeyId = crypto.randomUUID();
    const token = `${process.env.APP_API_KEY_PREFIX ?? "sak_"}${newApiKeyId}.${randomSecret(24)}`;
    const tokenHash = sha256(token);

    const { error: insertKeyError } = await supabase.from("api_keys").insert({
      id: newApiKeyId,
      org_id: orgId,
      workspace_id: workspaceId,
      name: currentKey.name,
      token_hash: tokenHash,
      status: "active",
      created_by: user.id,
      expires_at: currentKey.expires_at
    });

    if (insertKeyError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DB_ERROR",
            message: insertKeyError.message
          }
        },
        { status: 500 }
      );
    }

    const { error: insertScopesError } = await supabase
      .from("api_key_scopes")
      .insert(scopes.map((scope: string) => ({ api_key_id: newApiKeyId, scope })));

    if (insertScopesError) {
      await supabase.from("api_keys").delete().eq("id", newApiKeyId);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DB_ERROR",
            message: insertScopesError.message
          }
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        apiKeyId: newApiKeyId,
        token
      }
    });
  } catch (error) {
    console.error("API key rotate proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
