#!/usr/bin/env node
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

if (secretKey.startsWith("sk_live_") && process.env.ALLOW_LIVE !== "1") {
  throw new Error("Refusing to run with live Stripe key. Use test key or set ALLOW_LIVE=1 explicitly.");
}

const stripe = new Stripe(secretKey);

const plans = [
  {
    key: "starter",
    name: "Sales AI Starter",
    description: "Starter plan - 7 day free trial (card required)",
    monthlyAmount: 7900,
    annualAmount: 75840,
  },
  {
    key: "growth",
    name: "Sales AI Growth",
    description: "Growth plan - 7 day free trial (card required)",
    monthlyAmount: 19900,
    annualAmount: 191040,
  },
  {
    key: "scale",
    name: "Sales AI Scale",
    description: "Scale plan - 7 day free trial (card required)",
    monthlyAmount: 59900,
    annualAmount: 575040,
  },
];

async function ensureProduct(plan) {
  const page = await stripe.products.list({ limit: 100, active: true });
  const existing = page.data.find(
    (product) => product.metadata?.catalog_key === plan.key || product.name === plan.name
  );

  if (existing) return existing;

  return stripe.products.create({
    name: plan.name,
    description: plan.description,
    metadata: {
      catalog_key: plan.key,
      managed_by: "sales-ai/scripts/create-stripe-catalog.mjs",
    },
  });
}

async function ensureRecurringPrice({ productId, lookupKey, amount, interval }) {
  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });

  if (existing.data[0]) return existing.data[0];

  return stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: amount,
    recurring: { interval },
    lookup_key: lookupKey,
    metadata: {
      managed_by: "sales-ai/scripts/create-stripe-catalog.mjs",
    },
  });
}

const created = [];

for (const plan of plans) {
  const product = await ensureProduct(plan);
  const monthlyPrice = await ensureRecurringPrice({
    productId: product.id,
    lookupKey: `sales_ai_${plan.key}_monthly`,
    amount: plan.monthlyAmount,
    interval: "month",
  });

  const annualPrice = await ensureRecurringPrice({
    productId: product.id,
    lookupKey: `sales_ai_${plan.key}_annual`,
    amount: plan.annualAmount,
    interval: "year",
  });

  created.push({
    plan: plan.key,
    productId: product.id,
    monthlyPriceId: monthlyPrice.id,
    annualPriceId: annualPrice.id,
  });
}

console.log("\nStripe catalog ready:\n");
for (const row of created) {
  console.log(`${row.plan.toUpperCase()} product: ${row.productId}`);
  console.log(`  monthly: ${row.monthlyPriceId}`);
  console.log(`  annual : ${row.annualPriceId}`);
}

console.log("\nVercel env values:\n");
for (const row of created) {
  const upper = row.plan.toUpperCase();
  console.log(`STRIPE_PRICE_${upper}_MONTHLY=${row.monthlyPriceId}`);
  console.log(`STRIPE_PRICE_${upper}_ANNUAL=${row.annualPriceId}`);
}
