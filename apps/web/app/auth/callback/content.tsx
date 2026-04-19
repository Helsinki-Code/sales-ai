"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackContent() {
  const supabase = createClient() as any;
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const anonOrPublishableKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        "";

      console.log("Auth callback - code:", code ? "present" : "missing");
      console.log("Auth callback - error:", error);

      // Handle OAuth errors
      if (error) {
        const errorDesc = searchParams.get("error_description") || error;
        console.error("OAuth error:", errorDesc);
        router.replace("/login?error=oauth_failed&details=" + encodeURIComponent(errorDesc));
        return;
      }

      if (!code) {
        console.error("No authorization code in callback");
        router.replace("/login?error=no_code");
        return;
      }

      // Resolve state-scoped flow metadata (next path + verifier).
      let nextPath = "/dashboard";
      let codeVerifier: string | null = null;
      if (state) {
        try {
          const flowRaw =
            localStorage.getItem(`oauth_flow_${state}`) ??
            sessionStorage.getItem(`oauth_flow_${state}`);
          if (flowRaw) {
            const flowData = JSON.parse(flowRaw);
            codeVerifier = flowData?.codeVerifier ?? null;
            nextPath = flowData?.next ?? "/dashboard";
          } else {
            // Backward compatibility for older base64 state payload.
            const stateData = JSON.parse(atob(state));
            nextPath = stateData?.next || "/dashboard";
          }
        } catch (e) {
          console.error("Failed to resolve auth state:", e);
        }
      }

      try {
        // Fallback to legacy non-state-scoped keys.
        if (!codeVerifier) {
          codeVerifier =
            localStorage.getItem("code_verifier") ??
            sessionStorage.getItem("code_verifier");
        }
        if (!codeVerifier) {
          console.error("No code verifier in browser storage");
          router.replace("/login?error=no_verifier");
          return;
        }

        // Exchange via OAuth 2.1 token endpoint (not exchangeCodeForSession which
        // looks for Supabase's own internal verifier, not ours)
        const tokenResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/oauth/token`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
              ...(anonOrPublishableKey ? { apikey: anonOrPublishableKey } : {}),
            },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              client_id: "a60a74a6-8f66-44de-85ab-236ea0cfec7e",
              redirect_uri: `${window.location.origin}/auth/callback`,
              code_verifier: codeVerifier,
            }),
          }
        );

        const tokenRaw = await tokenResponse.text();
        let tokenData: any = {};
        try {
          tokenData = tokenRaw ? JSON.parse(tokenRaw) : {};
        } catch {
          tokenData = { raw: tokenRaw };
        }
        console.log("Token exchange status:", tokenResponse.status, tokenData);

        if (!tokenResponse.ok || tokenData.error) {
          const detail =
            tokenData.error_description ||
            tokenData.error ||
            tokenData.message ||
            tokenData.msg ||
            tokenData.raw ||
            "token exchange failed";
          console.error("Token exchange error:", detail);
          router.replace("/login?error=token_failed&details=" + encodeURIComponent(detail));
          return;
        }

        // Set session with returned tokens
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
        });

        if (sessionError) {
          console.error("Session set error:", sessionError.message);
          router.replace("/login?error=session_failed&details=" + encodeURIComponent(sessionError.message));
          return;
        }

        if (state) {
          localStorage.removeItem(`oauth_flow_${state}`);
          sessionStorage.removeItem(`oauth_flow_${state}`);
        }
        localStorage.removeItem("oauth_flow_latest");
        sessionStorage.removeItem("oauth_flow_latest");
        localStorage.removeItem("code_verifier");
        localStorage.removeItem("oauth_state");
        sessionStorage.removeItem("code_verifier");
        sessionStorage.removeItem("oauth_state");
        router.replace(nextPath);
      } catch (err) {
        console.error("Unexpected error during callback:", err);
        router.replace("/login?error=callback_failed");
      }
    };

    handleCallback();
  }, [router, searchParams, supabase.auth]);

  return (
    <main className="container main-section">
      <p>Finalizing sign in...</p>
    </main>
  );
}
