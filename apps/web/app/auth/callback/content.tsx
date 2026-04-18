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

      // Decode state to get the next path (state validation handled server-side by Supabase)
      let nextPath = "/dashboard";
      if (state) {
        try {
          const stateData = JSON.parse(atob(state));
          nextPath = stateData.next || "/dashboard";
        } catch (e) {
          console.error("Failed to decode state:", e);
        }
      }

      try {
        // Exchange code for session with PKCE verifier
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.error("Auth exchange error:", exchangeError.message);
          router.replace("/login?error=auth_failed&details=" + encodeURIComponent(exchangeError.message));
          return;
        }

        // Verify session is established
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Session fetch error:", sessionError.message);
          router.replace("/login?error=session_failed&details=" + encodeURIComponent(sessionError.message));
          return;
        }

        if (session) {
          // Clear sensitive data from sessionStorage
          sessionStorage.removeItem("code_verifier");
          sessionStorage.removeItem("oauth_state");
          router.replace(nextPath);
        } else {
          console.error("No session after exchange");
          router.replace("/login?error=no_session");
        }
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
