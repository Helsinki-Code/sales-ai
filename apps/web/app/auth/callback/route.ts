import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

function getSupabaseKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

function getOAuthClientId(): string {
  return process.env.SUPABASE_OAUTH_CLIENT_ID ?? "a60a74a6-8f66-44de-85ab-236ea0cfec7e";
}

function getSafeNextPath(nextPath: string | null): string {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/dashboard";
  }
  return nextPath;
}

function clearOAuthCookies(response: NextResponse) {
  response.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });
  response.cookies.set("oauth_code_verifier", "", { maxAge: 0, path: "/" });
  response.cookies.set("oauth_next", "", { maxAge: 0, path: "/" });
}

async function exchangeOAuthCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  codeVerifier: string
): Promise<{ access_token: string; refresh_token: string }> {
  const tokenUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/oauth/token`;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    }),
    cache: "no-store",
  });

  const raw = await response.text();
  let payload: any = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { raw };
  }

  if (!response.ok || payload.error || !payload.access_token || !payload.refresh_token) {
    const detail =
      payload.error_description ??
      payload.error ??
      payload.message ??
      payload.msg ??
      payload.raw ??
      "token exchange failed";
    throw new Error(detail);
  }

  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  };
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const state = requestUrl.searchParams.get("state");

  const expectedState = request.cookies.get("oauth_state")?.value ?? null;
  const codeVerifier = request.cookies.get("oauth_code_verifier")?.value ?? null;
  const nextPath = getSafeNextPath(request.cookies.get("oauth_next")?.value ?? "/dashboard");

  const makeLoginRedirect = (err: string, details?: string) => {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", err);
    if (details) {
      loginUrl.searchParams.set("details", details);
    }
    const response = NextResponse.redirect(loginUrl);
    clearOAuthCookies(response);
    return response;
  };

  if (error) {
    return makeLoginRedirect("oauth_failed", errorDescription ?? error);
  }

  if (!code) {
    return makeLoginRedirect("no_code");
  }

  if (!state || !expectedState || state !== expectedState) {
    return makeLoginRedirect("state_mismatch");
  }

  if (!codeVerifier) {
    return makeLoginRedirect("missing_code_verifier");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = getSupabaseKey();
  const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET;

  if (!supabaseUrl || !supabaseKey) {
    return makeLoginRedirect("supabase_env_missing");
  }
  if (!clientSecret) {
    return makeLoginRedirect("oauth_secret_missing");
  }

  const response = NextResponse.redirect(new URL(nextPath, requestUrl.origin));

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  }) as any;

  try {
    const tokens = await exchangeOAuthCode(
      code,
      `${requestUrl.origin}/auth/callback`,
      getOAuthClientId(),
      clientSecret,
      codeVerifier
    );

    const { error: setSessionError } = await supabase.auth.setSession(tokens);
    if (setSessionError) {
      return makeLoginRedirect("session_failed", setSessionError.message ?? "session_failed");
    }

    clearOAuthCookies(response);
    return response;
  } catch (e: any) {
    return makeLoginRedirect("token_failed", e?.message ?? "token exchange failed");
  }
}
