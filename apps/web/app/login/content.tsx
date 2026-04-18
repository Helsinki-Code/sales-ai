"use client";

import { useSearchParams } from "next/navigation";

export default function LoginContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("redirect") ?? "/dashboard";

  const handleOAuthSignIn = async () => {
    const clientId = "a60a74a6-8f66-44de-85ab-236ea0cfec7e";
    const redirectUri = `${window.location.origin}/auth/callback`;
    const responseType = "code";
    const scope = "openid profile email";

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = btoa(JSON.stringify({ next: nextPath }));

    // Store verifier and state in sessionStorage for callback
    sessionStorage.setItem("code_verifier", codeVerifier);
    sessionStorage.setItem("oauth_state", state);

    const oauthUrl = new URL("https://ppeennufaqxqgdlryrja.supabase.co/auth/v1/oauth/authorize", "https://");
    oauthUrl.searchParams.set("client_id", clientId);
    oauthUrl.searchParams.set("redirect_uri", redirectUri);
    oauthUrl.searchParams.set("response_type", responseType);
    oauthUrl.searchParams.set("scope", scope);
    oauthUrl.searchParams.set("state", state);
    oauthUrl.searchParams.set("code_challenge", codeChallenge);
    oauthUrl.searchParams.set("code_challenge_method", "S256");

    window.location.href = oauthUrl.toString();
  };

  function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64URLEncode(array);
  }

  async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return base64URLEncode(new Uint8Array(hash));
  }

  function base64URLEncode(buffer: Uint8Array): string {
    return btoa(String.fromCharCode(...buffer))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  return (
    <main className="container main-section">
      <h1 className="page-title">Sign In</h1>
      <div className="card" style={{ maxWidth: "400px" }}>
        <p style={{ color: "var(--slate)", marginBottom: "1.5rem", textAlign: "center" }}>
          Sign in to access your Sales AI dashboard
        </p>
        <button
          onClick={handleOAuthSignIn}
          className="cta"
          style={{ width: "100%", cursor: "pointer" }}
        >
          Sign in with Sales AI
        </button>
        <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--slate)", textAlign: "center" }}>
          You'll be securely authenticated through Supabase
        </p>
      </div>
    </main>
  );
}
