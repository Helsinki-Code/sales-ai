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
      const nextPath = searchParams.get("next") ?? "/dashboard";

      console.log("Auth callback - code:", code ? "present" : "missing");
      console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

      if (code) {
        // Exchange code for session (magic link or OAuth callback)
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("Auth exchange error:", error.message);
          router.replace("/login?error=auth_failed&details=" + encodeURIComponent(error.message));
          return;
        }
      }

      // Verify session is established
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace(nextPath);
      } else {
        router.replace("/login?error=no_session");
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
