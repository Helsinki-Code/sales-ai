"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

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
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setError(signInError.message); setLoading(false); return; }
      router.replace(nextPath);
    } catch {
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
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (signUpError) { setError(signUpError.message); setLoading(false); return; }
      setSuccess("Account created! Check your email to verify, then sign in.");
      setEmail(""); setPassword(""); setConfirmPassword("");
      setLoading(false);
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  const handleOAuthSignIn = () => {
    window.location.href = `/auth/start?next=${encodeURIComponent(nextPath)}`;
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <Image src="/brand/brand-mark.svg" alt="Sales AI" width={28} height={28} />
          <span style={{ fontWeight: 800, fontSize: "1rem", letterSpacing: "-0.025em" }}>Sales AI</span>
        </div>

        {isOAuthFlow ? (
          <>
            <h1 className="auth-title">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h1>
            <p className="auth-subtitle">
              {mode === "signin"
                ? "Sign in to access your Sales AI workspace."
                : "Start your free 7-day trial today."}
            </p>

            {/* Tabs */}
            <div className="auth-tabs">
              <button
                className={`auth-tab ${mode === "signin" ? "active" : ""}`}
                onClick={() => { setMode("signin"); setError(null); }}
                type="button"
              >
                Sign in
              </button>
              <button
                className={`auth-tab ${mode === "signup" ? "active" : ""}`}
                onClick={() => { setMode("signup"); setError(null); }}
                type="button"
              >
                Sign up
              </button>
            </div>

            {error && <div className="auth-msg auth-msg-error" role="alert">{error}</div>}
            {success && <div className="auth-msg auth-msg-success" role="status">{success}</div>}

            {mode === "signin" ? (
              <form onSubmit={handlePasswordSignIn}>
                <div className="auth-field">
                  <label htmlFor="email-si">Email address</label>
                  <input id="email-si" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />
                </div>
                <div className="auth-field">
                  <label htmlFor="password-si">Password</label>
                  <input id="password-si" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary auth-submit">
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp}>
                <div className="auth-field">
                  <label htmlFor="email-su">Email address</label>
                  <input id="email-su" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />
                </div>
                <div className="auth-field">
                  <label htmlFor="password-su">Password</label>
                  <input id="password-su" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Min. 8 characters" />
                </div>
                <div className="auth-field">
                  <label htmlFor="confirm-su">Confirm password</label>
                  <input id="confirm-su" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Re-enter password" />
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary auth-submit">
                  {loading ? "Creating account…" : "Create account"}
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Sign in to access your Sales AI dashboard.</p>
            <button
              onClick={handleOAuthSignIn}
              className="btn btn-primary auth-submit"
              style={{ width: "100%" }}
            >
              Sign in with Sales AI
            </button>
            <p className="auth-hint">Securely authenticated through Supabase.</p>
          </>
        )}
      </div>
    </div>
  );
}
