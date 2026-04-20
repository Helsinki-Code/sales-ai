"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type BillingGateState = {
  isActive: boolean;
  billingStatus: string;
  canManageBilling: boolean;
  loaded: boolean;
};

const BILLING_RESTRICTED_PREFIXES = ["/playground", "/usage", "/keys", "/sales"];

function isBillingRestrictedPath(pathname: string): boolean {
  return BILLING_RESTRICTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = createClient() as any;
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "signed-out" | "signed-in">("loading");
  const [billingState, setBillingState] = useState<BillingGateState>({
    isActive: true,
    billingStatus: "not_started",
    canManageBilling: false,
    loaded: false,
  });

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

  useEffect(() => {
    let mounted = true;

    if (state !== "signed-in") return;

    fetch("/api/admin/billing/status", { cache: "no-store" })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as
          | {
              success?: boolean;
              data?: {
                isActive?: boolean;
                canManageBilling?: boolean;
                billing?: { billingStatus?: string };
              };
            }
          | null;

        if (!mounted) return;

        if (res.ok && payload?.success && payload.data) {
          setBillingState({
            isActive: Boolean(payload.data.isActive),
            billingStatus: payload.data.billing?.billingStatus || "not_started",
            canManageBilling: Boolean(payload.data.canManageBilling),
            loaded: true,
          });
          return;
        }

        // If billing status cannot be resolved, do not block session access.
        setBillingState((current) => ({ ...current, loaded: true }));
      })
      .catch(() => {
        if (!mounted) return;
        setBillingState((current) => ({ ...current, loaded: true }));
      });

    return () => {
      mounted = false;
    };
  }, [state, pathname]);

  if (state === "loading") {
    return <p>Checking session...</p>;
  }

  if (state === "signed-in" && !billingState.loaded) {
    return <p>Checking billing status...</p>;
  }

  if (state === "signed-in" && isBillingRestrictedPath(pathname) && !billingState.isActive) {
    return (
      <main>
        <h1 className="page-title">Billing Required</h1>
        <div className="card" style={{ maxWidth: "720px" }}>
          <p style={{ marginTop: 0 }}>
            This organization is currently <strong>{billingState.billingStatus}</strong>. These
            product surfaces are gated until billing is active.
          </p>
          <p style={{ color: "var(--slate)" }}>
            You can still access Billing and Settings. Start a 7-day trial (card required) or
            manage the existing subscription to resume access.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <a href="/billing" className="cta">
              Open Billing
            </a>
            <a
              href="/settings"
              style={{
                border: "1px solid var(--border)",
                borderRadius: "999px",
                padding: "0.65rem 1rem",
                fontWeight: 600,
              }}
            >
              Open Settings
            </a>
          </div>
          {!billingState.canManageBilling && (
            <p style={{ marginTop: "1rem", color: "var(--slate)" }}>
              Billing actions require owner or admin role in your organization.
            </p>
          )}
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
