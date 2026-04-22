import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/billing/stripe";
import {
  applyUnitPackPurchaseFromCheckoutSession,
  hasProcessedStripeEvent,
  recordStripeEventProcessed,
  syncOrgBillingFromSubscription,
} from "@/lib/billing/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InvoiceLike = {
  subscription?: string | null;
  customer?: string | null;
};

function extractOrgIdFromMetadata(metadata: Record<string, string> | null | undefined): string | null {
  const orgId = metadata?.org_id;
  return typeof orgId === "string" && orgId.length > 0 ? orgId : null;
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json(
        { success: false, error: { code: "CONFIG_ERROR", message: "Missing STRIPE_WEBHOOK_SECRET" } },
        { status: 500 }
      );
    }

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "Missing stripe-signature header" } },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const rawBody = await request.text();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (await hasProcessedStripeEvent(event.id)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    let processedOrgId: string | null = null;
    let processedCustomerId: string | null = null;
    let processedSubscriptionId: string | null = null;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const syncResult = await syncOrgBillingFromSubscription(
            subscription,
            extractOrgIdFromMetadata(session.metadata),
            { eventId: event.id, eventType: event.type }
          );

          processedOrgId = syncResult.orgId;
          processedCustomerId = syncResult.stripeCustomerId;
          processedSubscriptionId = syncResult.stripeSubscriptionId;
        } else if (session.mode === "payment" && session.metadata?.purchase_type === "unit_pack") {
          const topupResult = await applyUnitPackPurchaseFromCheckoutSession(session, {
            eventId: event.id,
            eventType: event.type,
          });
          processedOrgId = topupResult.orgId;
          processedCustomerId = topupResult.stripeCustomerId;
          processedSubscriptionId = topupResult.stripeSubscriptionId;
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object;
        const syncResult = await syncOrgBillingFromSubscription(subscription, null, {
          eventId: event.id,
          eventType: event.type,
        });
        processedOrgId = syncResult.orgId;
        processedCustomerId = syncResult.stripeCustomerId;
        processedSubscriptionId = syncResult.stripeSubscriptionId;
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as InvoiceLike;
        if (!invoice.subscription || typeof invoice.subscription !== "string") break;

        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const syncResult = await syncOrgBillingFromSubscription(subscription, null, {
          eventId: event.id,
          eventType: event.type,
        });
        processedOrgId = syncResult.orgId;
        processedCustomerId = syncResult.stripeCustomerId ?? invoice.customer ?? null;
        processedSubscriptionId = syncResult.stripeSubscriptionId;
        break;
      }

      default:
        break;
    }

    await recordStripeEventProcessed(
      event,
      processedOrgId,
      processedCustomerId,
      processedSubscriptionId
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "WEBHOOK_ERROR", message } },
      { status: 400 }
    );
  }
}
