import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

const SALES_API_URL = process.env.SALES_API_URL || "https://sales-ai-api-468526005573.asia-south1.run.app";

export interface ApiProxyOptions {
  includeWorkspaceId?: boolean;
}

export async function apiProxy(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: Record<string, unknown>,
  options: ApiProxyOptions = {}
) {
  const supabase = await createClient();

  // Get the session
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Unauthorized: No session found");
  }

  // Get workspace ID if needed
  let workspaceId: string | undefined;
  if (options.includeWorkspaceId !== false) {
    try {
      workspaceId = await getWorkspaceId(session.user.id);
    } catch (error) {
      console.warn("Could not resolve workspace ID:", error);
    }
  }

  // Build URL
  const url = new URL(endpoint, SALES_API_URL);

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-supabase-access-token": session.access_token
  };

  if (workspaceId) {
    headers["x-workspace-id"] = workspaceId;
  }

  // Make the request
  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  // Parse response
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(
      errorData.error?.message || `API Error: ${response.status} ${response.statusText}`
    );
    (error as any).status = response.status;
    (error as any).data = errorData;
    throw error;
  }

  return response.json();
}
