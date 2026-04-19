import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

function getSupabaseKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

function getOAuthClientId(): string {
  return process.env.SUPABASE_OAUTH_CLIENT_ID ?? "a60a74a6-8f66-44de-85ab-236ea0cfec7e";
}

function getSafeNextPathFromState(state: string | null): string {
  if (!state) return "/dashboard";
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    const nextPath = typeof parsed?.next === "string" ? parsed.next : "/dashboard";
    return nextPath.startsWith("/") ? nextPath : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

async function exchangeOAuthCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const state = requestUrl.searchParams.get("state");
  const nextPath = getSafeNextPathFromState(state);

  if (error) {
    const detail = encodeURIComponent(errorDescription ?? error);
    return NextResponse.redirect(new URL(`/login?error=oauth_failed&details=${detail}`, requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", requestUrl.origin));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = getSupabaseKey();
  const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(new URL("/login?error=supabase_env_missing", requestUrl.origin));
  }
  if (!clientSecret) {
    return NextResponse.redirect(new URL("/login?error=oauth_secret_missing", requestUrl.origin));
  }

  const redirectUrl = new URL(nextPath, requestUrl.origin);
  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return [];
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
      clientSecret
    );

    const { error: setSessionError } = await supabase.auth.setSession(tokens);
    if (setSessionError) {
      const detail = encodeURIComponent(setSessionError.message ?? "session_failed");
      return NextResponse.redirect(new URL(`/login?error=session_failed&details=${detail}`, requestUrl.origin));
    }

    return response;
  } catch (e: any) {
    const detail = encodeURIComponent(e?.message ?? "token exchange failed");
    return NextResponse.redirect(new URL(`/login?error=token_failed&details=${detail}`, requestUrl.origin));
  }
}
