export type BillingPlanKey = "starter" | "growth" | "scale";
export type BillingInterval = "monthly" | "annual";

type PlanDefinition = {
  key: BillingPlanKey;
  label: string;
  description: string;
  monthlyAmountCents: number;
  annualAmountCents: number;
  monthlyEnvVar: string;
  annualEnvVar: string;
};

const PLAN_DEFINITIONS: Record<BillingPlanKey, PlanDefinition> = {
  starter: {
    key: "starter",
    label: "Starter",
    description: "For small teams getting started with AI-assisted sales workflows.",
    monthlyAmountCents: 7900,
    annualAmountCents: 75840,
    monthlyEnvVar: "STRIPE_PRICE_STARTER_MONTHLY",
    annualEnvVar: "STRIPE_PRICE_STARTER_ANNUAL",
  },
  growth: {
    key: "growth",
    label: "Growth",
    description: "For growing teams running frequent campaigns across multiple reps.",
    monthlyAmountCents: 19900,
    annualAmountCents: 191040,
    monthlyEnvVar: "STRIPE_PRICE_GROWTH_MONTHLY",
    annualEnvVar: "STRIPE_PRICE_GROWTH_ANNUAL",
  },
  scale: {
    key: "scale",
    label: "Scale",
    description: "For high-volume organizations needing advanced throughput and control.",
    monthlyAmountCents: 59900,
    annualAmountCents: 575040,
    monthlyEnvVar: "STRIPE_PRICE_SCALE_MONTHLY",
    annualEnvVar: "STRIPE_PRICE_SCALE_ANNUAL",
  },
};

export const BILLING_TRIAL_DAYS = 7;

export function isBillingPlanKey(value: unknown): value is BillingPlanKey {
  return value === "starter" || value === "growth" || value === "scale";
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

export function getStripePriceId(plan: BillingPlanKey, interval: BillingInterval): string {
  const definition = PLAN_DEFINITIONS[plan];
  const envVarName = interval === "monthly" ? definition.monthlyEnvVar : definition.annualEnvVar;
  const priceId = process.env[envVarName];

  if (!priceId) {
    throw new Error(`Missing required env var: ${envVarName}`);
  }

  return priceId;
}

export function resolvePlanFromPriceId(priceId: string | null | undefined): {
  plan: BillingPlanKey;
  interval: BillingInterval;
} | null {
  if (!priceId) return null;

  for (const definition of Object.values(PLAN_DEFINITIONS)) {
    if (process.env[definition.monthlyEnvVar] === priceId) {
      return { plan: definition.key, interval: "monthly" };
    }
    if (process.env[definition.annualEnvVar] === priceId) {
      return { plan: definition.key, interval: "annual" };
    }
  }

  return null;
}

export function getBillingPlanCatalog() {
  return Object.values(PLAN_DEFINITIONS).map((definition) => ({
    key: definition.key,
    label: definition.label,
    description: definition.description,
    monthlyAmountCents: definition.monthlyAmountCents,
    annualAmountCents: definition.annualAmountCents,
    monthlyConfigured: Boolean(process.env[definition.monthlyEnvVar]),
    annualConfigured: Boolean(process.env[definition.annualEnvVar]),
  }));
}
