"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthDetails = {
  client: { name: string };
  redirect_uri: string;
  scope?: string;
};

function getRedirectUrl(data: any): string | null {
  if (!data) return null;
  if (typeof data === "string") return data;
  return data.redirect_url ?? data.redirect_to ?? data.redirectTo ?? null;
}

export default function OAuthConsentContent() {
  const supabase = createClient() as any;
  const searchParams = useSearchParams();
  const router = useRouter();
  const authorizationId = searchParams.get("authorization_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<AuthDetails | null>(null);

  const loginRedirect = useMemo(() => {
    if (!authorizationId) return "/login";
    return `/login?redirect=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`;
  }, [authorizationId]);

  useEffect(() => {
    let mounted = true;
    const oauth = (supabase.auth as any).oauth;

    async function load() {
      if (!authorizationId) {
        setError("Missing authorization_id");
        setLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace(loginRedirect);
        return;
      }

      const { data, error: detailsError } = await oauth.getAuthorizationDetails(authorizationId);

      if (!mounted) return;
      if (detailsError) {
        console.error("Authorization details error:", detailsError);
        setError(detailsError.message ?? "Failed to load authorization request");
      } else if (getRedirectUrl(data)) {
        // Auto-approved requests can skip consent and return redirect URL directly.
        window.location.href = getRedirectUrl(data)!;
        return;
      } else if (!data || !data.client) {
        console.error("Invalid authorization data:", data);
        setError("OAuth client not found. Check if client is registered in Supabase.");
      } else {
        setDetails(data as AuthDetails);
      }
      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [authorizationId, loginRedirect, router, supabase.auth]);

  async function handleDecision(decision: "approve" | "deny") {
    if (!authorizationId) return;
    const oauth = (supabase.auth as any).oauth;

    if (decision === "approve") {
      const { data, error: approveError } = await oauth.approveAuthorization(authorizationId);
      if (approveError) {
        setError(approveError.message);
        return;
      }
      const redirectUrl = getRedirectUrl(data);
      console.log("Approve redirect data:", data, "->", redirectUrl);
      if (!redirectUrl) {
        setError("No redirect URL returned from Supabase");
        return;
      }
      window.location.href = redirectUrl;
      return;
    }

    const { data, error: denyError } = await oauth.denyAuthorization(authorizationId);
    if (denyError) {
      setError(denyError.message);
      return;
    }
    const redirectUrl = getRedirectUrl(data);
    if (!redirectUrl) {
      setError("No redirect URL returned from Supabase");
      return;
    }
    window.location.href = redirectUrl;
  }

  if (loading) {
    return (
      <main className="container main-section">
        <p>Loading authorization request...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container main-section">
        <div className="card">
          <h2>OAuth Error</h2>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="container main-section">
        <div className="card">
          <p>No authorization details found.</p>
        </div>
      </main>
    );
  }

  const scopes = details.scope?.trim() ? details.scope.split(" ") : [];

  return (
    <main className="container main-section">
      <div className="card">
        <h1 className="page-title">Authorize {details.client.name}</h1>
        <p>This application is requesting access to your Sales AI account.</p>
        <p>
          <strong>Redirect URI:</strong> {details.redirect_uri}
        </p>

        {scopes.length > 0 ? (
          <>
            <p>
              <strong>Requested permissions:</strong>
            </p>
            <ul>
              {scopes.map((scope) => (
                <li key={scope}>{scope}</li>
              ))}
            </ul>
          </>
        ) : null}

        <div className="nav-links" style={{ marginTop: "1rem" }}>
          <button className="cta" type="button" onClick={() => void handleDecision("approve")}>
            Approve
          </button>
          <button className="cta" type="button" onClick={() => void handleDecision("deny")}>
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}
