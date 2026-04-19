import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { encryptText } from "@/lib/server-crypto";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { workspaceId, orgId } = await getWorkspaceContext(session.user.id);
    const body = await request.json();
    const provider = typeof body?.provider === "string" ? body.provider : "";
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";

    if (provider !== "anthropic") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "provider must be \"anthropic\""
          }
        },
        { status: 400 }
      );
    }

    if (apiKey.length < 16) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "apiKey must be at least 16 characters"
          }
        },
        { status: 400 }
      );
    }

    const encryptionKey = process.env.INTERNAL_ENCRYPTION_KEY;
    if (!encryptionKey) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_ENV",
            message: "INTERNAL_ENCRYPTION_KEY is not configured."
          }
        },
        { status: 500 }
      );
    }

    const encrypted = encryptText(apiKey, encryptionKey);

    const { error } = await supabase
      .from("provider_credentials")
      .upsert(
        {
          workspace_id: workspaceId,
          org_id: orgId,
          provider: "anthropic",
          api_key_encrypted: encrypted,
          status: "active",
          updated_by: session.user.id
        },
        { onConflict: "workspace_id,provider" }
      );

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
        workspaceId,
        provider: "anthropic",
        status: "active"
      }
    });
  } catch (error) {
    console.error("Provider credentials proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
