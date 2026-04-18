"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [state, setState] = useState<"loading" | "signed-out" | "signed-in">("loading");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState(data.session ? "signed-in" : "signed-out");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? "signed-in" : "signed-out");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") {
    return <p>Checking session...</p>;
  }

  if (state === "signed-out") {
    return (
      <div className="card">
        <h3>Authentication Required</h3>
        <p>You need a Supabase session to access app dashboards.</p>
        <Link href="/login" className="cta">Go to Login</Link>
      </div>
    );
  }

  return <>{children}</>;
}
