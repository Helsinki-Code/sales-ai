import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function getOAuthClientId(): string {
  return process.env.SUPABASE_OAUTH_CLIENT_ID ?? "a60a74a6-8f66-44de-85ab-236ea0cfec7e";
}

function getSafeNextPath(nextPath: string | null): string {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/dashboard";
  }
  return nextPath;
}

function toBase64Url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generateVerifier(): string {
  return toBase64Url(randomBytes(48));
}

function generateState(): string {
  return toBase64Url(randomBytes(24));
}

function generateChallenge(verifier: string): string {
  return toBase64Url(createHash("sha256").update(verifier).digest());
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.redirect(new URL("/login?error=supabase_env_missing", requestUrl.origin));
  }

  const state = generateState();
  const codeVerifier = generateVerifier();
  const codeChallenge = generateChallenge(codeVerifier);

  const authorizeUrl = new URL(`${supabaseUrl}/auth/v1/oauth/authorize`);
  authorizeUrl.searchParams.set("client_id", getOAuthClientId());
  authorizeUrl.searchParams.set("redirect_uri", `${requestUrl.origin}/auth/callback`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid profile email");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorizeUrl);
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  };

  response.cookies.set("oauth_state", state, cookieOptions);
  response.cookies.set("oauth_code_verifier", codeVerifier, cookieOptions);
  response.cookies.set("oauth_next", nextPath, cookieOptions);

  return response;
}
