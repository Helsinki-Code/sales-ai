# Stripe Billing Setup (Org-Level, 7-Day Trial)

## 1) Environment Variables
Set these in Vercel (Preview + Production):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_STARTER_ANNUAL`
- `STRIPE_PRICE_GROWTH_MONTHLY`
- `STRIPE_PRICE_GROWTH_ANNUAL`
- `STRIPE_PRICE_SCALE_MONTHLY`
- `STRIPE_PRICE_SCALE_ANNUAL`
- `SUPABASE_SERVICE_ROLE_KEY`

Keep `NEXT_PUBLIC_APP_URL` set to your deployed app domain.

## 2) Webhook Registration
Register one webhook endpoint:

- URL: `https://<your-domain>/api/stripe/webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `customer.subscription.trial_will_end`
  - `invoice.paid`
  - `invoice.payment_failed`

Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## 3) Create Catalog (Test Mode)
Use a Stripe **test** secret key:

```bash
STRIPE_SECRET_KEY=sk_test_... npm run stripe:catalog
```

The script creates/ensures:
- Starter: monthly `7900`, annual `75840`
- Growth: monthly `19900`, annual `191040`
- Scale: monthly `59900`, annual `575040`

It prints the exact `STRIPE_PRICE_*` env values to paste into Vercel.

## 4) Test Mode First
1. Create Stripe products/prices in **test mode**.
2. Put test price IDs into the plan env vars.
3. Deploy and test:
   - checkout starts trial with card required
   - webhook updates `org_billing`
   - blocked orgs receive `402` on `/api/sales/*`
   - billing/settings remain accessible

## 5) Go Live Switch
1. Create equivalent products/prices in **live mode**.
2. Replace env vars with live mode keys/price IDs.
3. Register live webhook endpoint and set live webhook secret.
4. Redeploy.

## 6) Runbook

### Replay missed webhook events
- Use Stripe Dashboard event replay against `/api/stripe/webhook`.
- Idempotency is enforced through `billing_webhook_events.event_id` uniqueness.

### Stripe outage behavior
- Existing `active`/`trialing` orgs continue until status changes.
- Checkout/Portal creation can fail; users should retry from Billing page.

### Backfill subscription state
If webhook delivery was interrupted:
1. Pull subscription IDs from Stripe.
2. Re-deliver events or trigger manual sync by replaying `customer.subscription.updated` and recent invoice events.
3. Confirm rows in `org_billing` are current.
