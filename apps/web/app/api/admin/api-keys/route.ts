import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { randomSecret, sha256 } from "@/lib/server-crypto";
import { ensureBillingActiveForOrg } from "@/lib/billing/status";
import crypto from "node:crypto";

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

    const { workspaceId } = await getWorkspaceContext(user.id);

    const { data, error } = await supabase
      .from("api_keys")
      .select("id,name,status,last_used_at,expires_at,created_at,revoked_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

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
    console.error("API keys GET proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    const billingBlockResponse = await ensureBillingActiveForOrg(orgId, request);
    if (billingBlockResponse) {
      return billingBlockResponse;
    }

    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const scopes = Array.isArray(body?.scopes)
      ? body.scopes.filter((scope: unknown): scope is string => typeof scope === "string" && scope.trim().length > 0)
      : [];
    const expiresAt = typeof body?.expiresAt === "string" ? body.expiresAt : null;

    if (name.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "name must be at least 2 characters"
          }
        },
        { status: 400 }
      );
    }

    if (scopes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "At least one scope is required"
          }
        },
        { status: 400 }
      );
    }

    const apiKeyId = crypto.randomUUID();
    const token = `${process.env.APP_API_KEY_PREFIX ?? "sak_"}${apiKeyId}.${randomSecret(24)}`;
    const tokenHash = sha256(token);

    const { error: insertKeyError } = await supabase.from("api_keys").insert({
      id: apiKeyId,
      org_id: orgId,
      workspace_id: workspaceId,
      name,
      token_hash: tokenHash,
      status: "active",
      created_by: user.id,
      expires_at: expiresAt
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
      .insert(scopes.map((scope: string) => ({ api_key_id: apiKeyId, scope })));

    if (insertScopesError) {
      await supabase.from("api_keys").delete().eq("id", apiKeyId);
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

    return NextResponse.json(
      { success: true, data: { apiKeyId, token } },
      { status: 201 }
    );
  } catch (error) {
    console.error("API keys POST proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
