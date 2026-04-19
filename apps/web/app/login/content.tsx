"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("redirect") ?? "/dashboard";
  const isOAuthFlow = nextPath.includes("authorization_id");

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient() as any;

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.replace(nextPath);
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      setSuccess("Account created! Check your email to verify, then sign in.");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setLoading(false);
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async () => {
    const clientId =
      process.env.NEXT_PUBLIC_SUPABASE_OAUTH_CLIENT_ID ??
      "a60a74a6-8f66-44de-85ab-236ea0cfec7e";
    const redirectUri = `${window.location.origin}/auth/callback`;
    const responseType = "code";
    const scope = "openid profile email";

    const statePayload = {
      next: nextPath,
      nonce: generateNonce(),
      createdAt: Date.now(),
    };
    const state = btoa(JSON.stringify(statePayload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const oauthUrl = new URL("https://ppeennufaqxqgdlryrja.supabase.co/auth/v1/oauth/authorize");
    oauthUrl.searchParams.set("client_id", clientId);
    oauthUrl.searchParams.set("redirect_uri", redirectUri);
    oauthUrl.searchParams.set("response_type", responseType);
    oauthUrl.searchParams.set("scope", scope);
    oauthUrl.searchParams.set("state", state);

    window.location.href = oauthUrl.toString();
  };

  function generateNonce(): string {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  return (
    <main className="container main-section">
      <h1 className="page-title">{isOAuthFlow ? "Authenticate" : "Sign In"}</h1>
      <div className="card" style={{ maxWidth: "400px" }}>
        {isOAuthFlow ? (
          <>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)" }}>
              <button
                onClick={() => { setMode("signin"); setError(null); }}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  border: "none",
                  background: mode === "signin" ? "var(--mint)" : "transparent",
                  color: mode === "signin" ? "var(--ink)" : "var(--slate)",
                  cursor: "pointer",
                  fontWeight: mode === "signin" ? "600" : "400",
                }}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode("signup"); setError(null); }}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  border: "none",
                  background: mode === "signup" ? "var(--mint)" : "transparent",
                  color: mode === "signup" ? "var(--ink)" : "var(--slate)",
                  cursor: "pointer",
                  fontWeight: mode === "signup" ? "600" : "400",
                }}
              >
                Sign Up
              </button>
            </div>

            {mode === "signin" ? (
              <form onSubmit={handlePasswordSignIn}>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      fontSize: "1rem",
                    }}
                  />
                </div>
                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      fontSize: "1rem",
                    }}
                  />
                </div>
                {error && (
                  <p style={{ color: "red", marginBottom: "1rem", fontSize: "0.9rem" }}>
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="cta"
                  style={{ width: "100%", cursor: loading ? "not-allowed" : "pointer" }}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp}>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      fontSize: "1rem",
                    }}
                  />
                </div>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      fontSize: "1rem",
                    }}
                  />
                </div>
                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      fontSize: "1rem",
                    }}
                  />
                </div>
                {error && (
                  <p style={{ color: "red", marginBottom: "1rem", fontSize: "0.9rem" }}>
                    {error}
                  </p>
                )}
                {success && (
                  <p style={{ color: "green", marginBottom: "1rem", fontSize: "0.9rem" }}>
                    {success}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="cta"
                  style={{ width: "100%", cursor: loading ? "not-allowed" : "pointer" }}
                >
                  {loading ? "Creating account..." : "Sign Up"}
                </button>
              </form>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </main>
  );
}
