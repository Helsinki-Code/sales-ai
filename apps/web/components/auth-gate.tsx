"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = createClient() as any;
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "signed-out" | "signed-in">("loading");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }: any) => {
      if (!mounted) return;
      if (data.session) {
        setState("signed-in");
      } else {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session) {
        setState("signed-in");
      } else {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router, pathname]);

  if (state === "loading") {
    return <p>Checking session...</p>;
  }

  return <>{children}</>;
}
