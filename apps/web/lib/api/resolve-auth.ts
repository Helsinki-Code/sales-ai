import { getWorkspaceContext } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";

export type AuthResult =
  | { type: "apikey"; token: string }
  | { type: "session"; accessToken: string; workspaceId: string; orgId: string }
  | null;

export async function resolveAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization") || "";

  // Check for API key in Authorization header: "Bearer sak_..."
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token.startsWith("sak_")) {
      return { type: "apikey", token };
    }
  }

  // Fall back to Supabase session from cookies
  try {
    const supabase = await createClient();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      return null;
    }

    const { workspaceId, orgId } = await getWorkspaceContext(session.user.id);

    return {
      type: "session",
      accessToken: session.access_token,
      workspaceId,
      orgId,
    };
  } catch (error) {
    return null;
  }
}
