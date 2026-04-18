"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const supabase = createClient() as any;
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const nextPath = searchParams.get("next") ?? "/dashboard";

    supabase.auth.getSession().then(() => {
      router.replace(nextPath);
    });
  }, [router, searchParams]);

  return (
    <main className="container main-section">
      <p>Finalizing sign in...</p>
    </main>
  );
}
