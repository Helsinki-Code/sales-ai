"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type BillingPlanKey = "starter" | "growth" | "scale";
type BillingInterval = "monthly" | "annual";
type UnitPackKey = "standard_1000" | "lead_500";

type CatalogPlan = {
  key: BillingPlanKey;
  label: string;
  description: string;
  monthlyAmountCents: number;
  annualAmountCents: number;
  monthlyConfigured: boolean;
  annualConfigured: boolean;
};

type UnitWallet = {
  currentPlanKey: string | null;
  cycleStartAt: string | null;
  cycleEndAt: string | null;
  includedStandardUnits: number;
  includedLeadUnits: number;
  purchasedStandardUnits: number;
  purchasedLeadUnits: number;
  consumedStandardUnits: number;
  consumedLeadUnits: number;
};

type UnitPackCatalogItem = {
  key: UnitPackKey;
  label: string;
  description: string;
  unitClass: "standard" | "lead";
  unitsStandard: number;
  unitsLead: number;
  amountCents: number;
  configuredPriceId: string | null;
};

type BillingStatusPayload = {
  orgId: string;
  role: "owner" | "admin" | "member";
  canManageBilling: boolean;
  isActive: boolean;
  billing: {
    billingStatus: string;
    trialStartAt: string | null;
    trialEndAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    stripePriceId: string | null;
    currentPlan: { plan: BillingPlanKey; interval: BillingInterval } | null;
  };
  units: UnitWallet;
  catalog: CatalogPlan[];
  unitPackCatalog: UnitPackCatalogItem[];
};

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [statusData, setStatusData] = useState<BillingStatusPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPlanFromQuery = searchParams.get("plan");
  const checkoutStateFromQuery = searchParams.get("checkout");
  const topupStateFromQuery = searchParams.get("topup");
  const intentFromQuery = searchParams.get("intent");

  useEffect(() => {
    if (checkoutStateFromQuery === "success") {
      setMessage("Subscription checkout completed. Billing status will refresh in a few seconds.");
    } else if (checkoutStateFromQuery === "cancelled") {
      setMessage("Subscription checkout was cancelled.");
    }
  }, [checkoutStateFromQuery]);

  useEffect(() => {
    if (topupStateFromQuery === "success") {
      setMessage("Unit pack purchase completed. Your balance will refresh in a few seconds.");
    } else if (topupStateFromQuery === "cancelled") {
      setMessage("Unit pack checkout was cancelled.");
    }
  }, [topupStateFromQuery]);

  useEffect(() => {
    if (selectedPlanFromQuery === "starter" || selectedPlanFromQuery === "growth" || selectedPlanFromQuery === "scale") {
      setMessage(`Plan preselected: ${selectedPlanFromQuery}`);
    }
  }, [selectedPlanFromQuery]);

  const fetchStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/billing/status", { cache: "no-store" });
      const payload = (await response.json()) as
        | { success?: boolean; data?: BillingStatusPayload; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error?.message || "Failed to load billing status");
      }

      setStatusData(payload.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load billing status");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  const sortedPlans = useMemo(() => {
    if (!statusData) return [];
    return [...statusData.catalog].sort((a, b) => a.monthlyAmountCents - b.monthlyAmountCents);
  }, [statusData]);

  const sortedPacks = useMemo(() => {
    if (!statusData) return [];
    return [...statusData.unitPackCatalog].sort((a, b) => a.amountCents - b.amountCents);
  }, [statusData]);

  const handleStartCheckout = async (plan: BillingPlanKey) => {
    setIsSubmitting(`checkout:${plan}`);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });

      const payload = (await response.json()) as
        | { success?: boolean; data?: { url?: string }; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.success || !payload.data?.url) {
        throw new Error(payload?.error?.message || "Failed to create checkout session");
      }

      window.location.assign(payload.data.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Failed to create checkout session");
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleBuyPack = async (packKey: UnitPackKey) => {
    setIsSubmitting(`pack:${packKey}`);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/billing/units/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packKey }),
      });

      const payload = (await response.json()) as
        | { success?: boolean; data?: { url?: string }; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.success || !payload.data?.url) {
        throw new Error(payload?.error?.message || "Failed to create unit pack checkout session");
      }

      window.location.assign(payload.data.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Failed to create unit pack checkout session");
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleOpenPortal = async () => {
    setIsSubmitting("portal");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/billing/portal", {
        method: "POST",
      });

      const payload = (await response.json()) as
        | { success?: boolean; data?: { url?: string }; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.success || !payload.data?.url) {
        throw new Error(payload?.error?.message || "Failed to open billing portal");
      }

      window.location.assign(payload.data.url);
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : "Failed to open billing portal");
    } finally {
      setIsSubmitting(null);
    }
  };

  if (isLoading) {
    return (
      <main>
        <h1 className="page-title">Billing</h1>
        <p>Loading billing data...</p>
      </main>
    );
  }

  if (!statusData) {
    return (
      <main>
        <h1 className="page-title">Billing</h1>
        <div className="card">
          <p>Unable to load billing data.</p>
          {error && <p style={{ color: "var(--slate)" }}>{error}</p>}
          <button className="cta" onClick={() => void fetchStatus()}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  const standardRemaining = Math.max(
    statusData.units.includedStandardUnits +
      statusData.units.purchasedStandardUnits -
      statusData.units.consumedStandardUnits,
    0
  );
  const leadRemaining = Math.max(
    statusData.units.includedLeadUnits +
      statusData.units.purchasedLeadUnits -
      statusData.units.consumedLeadUnits,
    0
  );

  return (
    <main>
      <h1 className="page-title">Billing</h1>
      <p style={{ color: "var(--slate)", marginTop: "-0.25rem", marginBottom: "1.25rem" }}>
        Organization-level subscription and unit management.
      </p>

      {message && (
        <div className="card" style={{ marginBottom: "1rem", borderColor: "#cce5dc" }}>
          <p style={{ margin: 0 }}>{message}</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ marginBottom: "1rem", borderColor: "#f2c9bc" }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0, marginBottom: "1rem" }}>Current Status</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.8rem" }}>
          <div>
            <div style={{ color: "var(--slate)", fontSize: "0.85rem" }}>Billing Status</div>
            <div style={{ fontWeight: 700 }}>{statusData.billing.billingStatus}</div>
          </div>
          <div>
            <div style={{ color: "var(--slate)", fontSize: "0.85rem" }}>Current Plan</div>
            <div style={{ fontWeight: 700 }}>
              {statusData.billing.currentPlan
                ? `${statusData.billing.currentPlan.plan} (${statusData.billing.currentPlan.interval})`
                : "Not started"}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--slate)", fontSize: "0.85rem" }}>Trial Ends</div>
            <div style={{ fontWeight: 700 }}>{formatDate(statusData.billing.trialEndAt)}</div>
          </div>
          <div>
            <div style={{ color: "var(--slate)", fontSize: "0.85rem" }}>Current Period End</div>
            <div style={{ fontWeight: 700 }}>{formatDate(statusData.billing.currentPeriodEnd)}</div>
          </div>
        </div>

        <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            className="cta"
            onClick={() => void handleOpenPortal()}
            disabled={!statusData.canManageBilling || isSubmitting === "portal"}
          >
            {isSubmitting === "portal" ? "Opening..." : "Manage Billing"}
          </button>
          <button
            onClick={() => void fetchStatus()}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "999px",
              padding: "0.65rem 1rem",
              background: "transparent",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Refresh Status
          </button>
        </div>

        {!statusData.canManageBilling && (
          <p style={{ color: "var(--slate)", marginTop: "1rem", marginBottom: 0 }}>
            Billing updates are restricted to org owners and admins.
          </p>
        )}
      </div>

      <div className="grid grid-3" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <p style={{ color: "var(--slate)", margin: 0, fontSize: "0.9rem" }}>Standard Units</p>
          <p style={{ margin: "0.6rem 0 0", fontWeight: 700 }}>
            {statusData.units.consumedStandardUnits.toLocaleString()} used / {standardRemaining.toLocaleString()} remaining
          </p>
          <p style={{ color: "var(--slate)", margin: "0.3rem 0 0", fontSize: "0.84rem" }}>
            Included {statusData.units.includedStandardUnits.toLocaleString()} + Purchased{" "}
            {statusData.units.purchasedStandardUnits.toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p style={{ color: "var(--slate)", margin: 0, fontSize: "0.9rem" }}>Lead Units</p>
          <p style={{ margin: "0.6rem 0 0", fontWeight: 700 }}>
            {statusData.units.consumedLeadUnits.toLocaleString()} used / {leadRemaining.toLocaleString()} remaining
          </p>
          <p style={{ color: "var(--slate)", margin: "0.3rem 0 0", fontSize: "0.84rem" }}>
            Included {statusData.units.includedLeadUnits.toLocaleString()} + Purchased{" "}
            {statusData.units.purchasedLeadUnits.toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p style={{ color: "var(--slate)", margin: 0, fontSize: "0.9rem" }}>Cycle</p>
          <p style={{ margin: "0.6rem 0 0", fontWeight: 700 }}>{statusData.units.currentPlanKey ?? "not_set"}</p>
          <p style={{ color: "var(--slate)", margin: "0.3rem 0 0", fontSize: "0.84rem" }}>
            {formatDate(statusData.units.cycleStartAt)} → {formatDate(statusData.units.cycleEndAt)}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem", borderColor: intentFromQuery === "topup" ? "#9fb8ff" : "var(--border)" }}>
        <h2 style={{ marginTop: 0, marginBottom: "1rem" }}>Buy Extra Units</h2>
        <p style={{ color: "var(--slate)", marginTop: 0 }}>
          Fixed packs are valid for the current billing cycle only. Unused pack units do not roll over.
        </p>
        <div className="grid grid-3">
          {sortedPacks.map((pack) => (
            <article className="card" key={pack.key}>
              <h3>{pack.label}</h3>
              <p style={{ color: "var(--slate)", minHeight: "2.6rem" }}>{pack.description}</p>
              <div style={{ marginBottom: "0.8rem" }}>
                <strong style={{ fontSize: "1.45rem" }}>{formatUsd(pack.amountCents)}</strong>
                <span style={{ color: "var(--slate)" }}>/one-time</span>
              </div>
              <button
                className="cta"
                disabled={!statusData.canManageBilling || Boolean(isSubmitting)}
                onClick={() => void handleBuyPack(pack.key)}
              >
                {isSubmitting === `pack:${pack.key}` ? "Redirecting..." : "Buy Pack"}
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0, marginBottom: "1rem" }}>Choose Plan</h2>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <button
            onClick={() => setInterval("monthly")}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "999px",
              padding: "0.45rem 0.9rem",
              backgroundColor: interval === "monthly" ? "var(--accent)" : "transparent",
              color: interval === "monthly" ? "white" : "var(--ink)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval("annual")}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "999px",
              padding: "0.45rem 0.9rem",
              backgroundColor: interval === "annual" ? "var(--accent)" : "transparent",
              color: interval === "annual" ? "white" : "var(--ink)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Annual (20% off)
          </button>
        </div>

        <div className="grid grid-3">
          {sortedPlans.map((plan) => {
            const amount = interval === "monthly" ? plan.monthlyAmountCents : plan.annualAmountCents;
            const configured = interval === "monthly" ? plan.monthlyConfigured : plan.annualConfigured;

            return (
              <article className="card" key={plan.key}>
                <h3>{plan.label}</h3>
                <p style={{ color: "var(--slate)", minHeight: "2.6rem" }}>{plan.description}</p>
                <div style={{ marginBottom: "0.8rem" }}>
                  <strong style={{ fontSize: "1.45rem" }}>{formatUsd(amount)}</strong>
                  <span style={{ color: "var(--slate)" }}>/{interval === "monthly" ? "month" : "year"}</span>
                </div>
                <button
                  className="cta"
                  disabled={!statusData.canManageBilling || !configured || Boolean(isSubmitting)}
                  onClick={() => void handleStartCheckout(plan.key)}
                >
                  {isSubmitting === `checkout:${plan.key}` ? "Redirecting..." : "Start 7-day trial"}
                </button>
                {!configured && (
                  <p style={{ color: "var(--slate)", fontSize: "0.85rem", marginTop: "0.75rem" }}>
                    Plan is not configured yet.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
