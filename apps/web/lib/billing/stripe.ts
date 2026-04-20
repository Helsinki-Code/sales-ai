import Stripe from "stripe";

let cachedStripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  if (!cachedStripeClient) {
    cachedStripeClient = new Stripe(secretKey);
  }

  return cachedStripeClient;
}
