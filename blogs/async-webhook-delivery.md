# How to Set Up Webhooks for Long-Running Sales Jobs (Stop Polling Every 3 Seconds)

<!-- ============================================================
SEO METADATA
Title tag (59 chars): Async Sales Job Webhooks: Setup, Signatures, and Retries
Meta description (158 chars): Polling is fine to start. Webhooks are better at scale. Here's how to configure Sales AI webhooks — signature verification, retry logic, and a production FastAPI receiver.
Primary keyword: async webhook delivery API
Secondary keywords: webhook async job completion, sales API webhook setup, webhook signature verification, async prospecting webhook
URL slug: /blog/async-webhook-delivery-api
Schema type: TechArticle + FAQPage + HowTo
============================================================ -->

**Published:** April 2026 | **Reading time:** 9 min | **Audience:** Backend developers integrating Sales AI async jobs

---

<!-- ============================================================
FEATURED IMAGE
Image gen prompt: Dark-mode polling vs webhook comparison timeline illustration. LEFT "Polling (what you're doing now)": a vertical timeline showing a server making GET requests every 3 seconds — 18 small request arrows pointing up to a job queue, each labelled "still running...". Red annotation: "90 wasted calls, extra load, extra cost". RIGHT "Webhook (what you should do)": same timeline, just ONE moment at the bottom where the server does a POST to YOUR endpoint. Green annotation: "Zero wasted calls. Notified the moment it's done." Both timelines show the same 90-second job duration. Charcoal background. No people. 4K, 16:9.
Alt tag: Async webhook delivery API comparison showing polling making 90 requests every 3 seconds versus webhook delivering one notification at job completion
============================================================ -->

---

> **The situation:** You're calling `/sales/prospect` or `/sales/leads` for async prospect discovery. The job takes 60–90 seconds. Your current code polls `/jobs/{id}` every 3 seconds. That's 20–30 HTTP requests for a result you could have received in one push. Here's how to switch to webhooks — and how to receive them safely.

---

## Table of Contents

1. [Polling vs Webhooks — When Each Makes Sense](#polling-vs-webhooks)
2. [Configuring Your Webhook URL in Sales AI](#configuring-webhook-url)
3. [Webhook Payload Structure](#webhook-payload-structure)
4. [Signature Verification — The Non-Negotiable Step](#signature-verification)
5. [Production FastAPI Webhook Receiver](#production-fastapi-receiver)
6. [Retry Logic and What Happens on Failure](#retry-logic)
7. [Handling Duplicate Deliveries (Idempotency)](#idempotency)
8. [Testing Webhooks Locally](#testing-locally)
9. [FAQ: Async Webhook Delivery](#faq)

---

## Polling vs Webhooks — When Each Makes Sense

Both patterns work. The question is scale.

**Polling is right for:**
- Development and testing — no server needed, no public URL required
- One-off scripts or small-volume automation (< 100 jobs/month)
- Environments where you can't expose a public webhook endpoint

**Webhooks are right for:**
- Production pipelines processing async jobs regularly
- Any integration where you want to reduce HTTP overhead
- Serverless functions with cold-start cost concerns (polling + wait nodes are expensive at scale)
- When job completion needs to trigger downstream steps immediately

The performance difference at scale: polling at 5-second intervals for a 75-second job = **15 requests per job**. At 1,000 jobs/month: **15,000 unnecessary HTTP requests**. Webhooks reduce that to **1,000 delivery calls**, one per completion.

As [DEV Community's webhook processing guide](https://dev.to/whoffagents/webhook-processing-at-scale-idempotency-signature-verification-and-async-queues-45b3) captures the core rule: *"Webhooks are delivered at-least-once. Your endpoint will receive duplicates. Every webhook handler must be idempotent — processing the same event twice must produce the same result as processing it once."*

<!-- ============================================================
IMAGE 1 — Polling vs Webhook HTTP request count comparison
Image gen prompt: Dark-mode bar chart comparison. X-axis: "Monthly async jobs" — 100, 500, 1000, 5000. Y-axis: "HTTP requests". Two bar groups. "Polling (5s interval, 75s avg job)" bars grow steeply: 1,500 / 7,500 / 15,000 / 75,000. "Webhooks" bars stay flat: 100 / 500 / 1,000 / 5,000 — one request per completion. Gap annotation shows "93% fewer requests" at 5000 jobs. Dark background, red bars for polling, green bars for webhooks. No people. 16:9.
Alt tag: Async webhook delivery API HTTP request comparison showing polling generating 75000 requests versus webhooks generating 5000 requests at 5000 monthly jobs 93% reduction
============================================================ -->

---

## Configuring Your Webhook URL in Sales AI

**Step 1:** Your server needs a public HTTPS endpoint. For development, use [ngrok](https://ngrok.com/) to tunnel localhost:

```bash
ngrok http 8000
# → Forwarding: https://abc123.ngrok.io → localhost:8000
```

**Step 2:** In your Sales AI workspace, navigate to **Settings → Webhooks → Add Endpoint**.

Enter:
- **URL:** `https://your-server.com/webhooks/sales-ai` (or your ngrok URL for dev)
- **Events:** Select `job.completed` and `job.failed` (or `*` for all events)
- **Secret:** A random string you generate — Sales AI uses this to sign deliveries

Sales AI generates a webhook signing secret when you add the endpoint. Copy it immediately — it's shown once. Set it as `SALES_AI_WEBHOOK_SECRET` in your environment.

**Step 3:** Test the endpoint with Sales AI's delivery tester. If you get a 200 back, you're ready.

---

## Webhook Payload Structure

Sales AI sends a `POST` request to your endpoint for each event. The payload is always JSON:

```json
{
  "event": "job.completed",
  "event_id": "evt_01abc123def456",
  "timestamp": "2026-04-20T06:32:11Z",
  "job_id": "job_01xyz789",
  "job_type": "prospect_discovery",
  "workspace_id": "ws_01...",
  "result": {
    "prospects": [
      {
        "company": "DataFlow Inc",
        "title": "VP RevOps",
        "icp_score": 91,
        "research_summary": "Series B SaaS company, evaluating CRM stack...",
        "recent_signals": ["Raised Series B Q1 2026", "New VP Sales hire"]
      }
    ],
    "total_found": 25
  }
}
```

**For `job.failed` events:**
```json
{
  "event": "job.failed",
  "event_id": "evt_01...",
  "timestamp": "2026-04-20T06:35:00Z",
  "job_id": "job_01xyz789",
  "job_type": "prospect_discovery",
  "workspace_id": "ws_01...",
  "error": {
    "code": "ANTHROPIC_API_ERROR",
    "message": "Anthropic key rate limit exceeded",
    "retryable": true
  }
}
```

**Headers on every delivery:**
```
Content-Type: application/json
X-Sales-AI-Signature: sha256=<HMAC-SHA256 signature>
X-Sales-AI-Event: job.completed
X-Sales-AI-Event-ID: evt_01abc123def456
X-Sales-AI-Timestamp: 1713591131
```

---

## Signature Verification — The Non-Negotiable Step

Signature verification confirms the delivery came from Sales AI, not from an attacker posting forged payloads to your endpoint.

**How the signature is computed:**
```
HMAC-SHA256(webhook_secret, f"{timestamp}.{raw_body}")
```

Where:
- `webhook_secret` is the secret you set when configuring the webhook
- `timestamp` is the Unix timestamp from the `X-Sales-AI-Timestamp` header
- `raw_body` is the raw bytes of the request body (before JSON parsing)

**Critical:** Verify against the **raw request body**, not the parsed JSON. Parsing and re-serialising JSON can change whitespace and key ordering, breaking the signature.

**Python (FastAPI):**
```python
import hmac
import hashlib
import time

WEBHOOK_SECRET = os.environ["SALES_AI_WEBHOOK_SECRET"]

def verify_sales_ai_signature(raw_body: bytes, signature_header: str, timestamp_header: str) -> bool:
    """
    Verify HMAC-SHA256 signature from Sales AI webhook delivery.
    Returns True if valid, False if forged or tampered.
    """
    if not signature_header or not timestamp_header:
        return False
    
    # Reject events older than 5 minutes (replay attack prevention)
    try:
        event_timestamp = int(timestamp_header)
        if abs(time.time() - event_timestamp) > 300:
            return False
    except ValueError:
        return False
    
    # Compute expected signature
    signed_payload = f"{timestamp_header}.{raw_body.decode('utf-8')}"
    expected = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        signed_payload.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    expected_header = f"sha256={expected}"
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_header, signature_header)
```

The timestamp check prevents **replay attacks** — where an attacker captures a valid webhook delivery and re-sends it hours later. As [Stripe's webhook documentation](https://stripe.com/docs/webhooks/signatures) establishes as the industry standard: reject any event with a timestamp older than your tolerance window (5 minutes is typical).

---

## Production FastAPI Webhook Receiver

```python
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import hmac
import hashlib
import time
import json
import logging

logger = logging.getLogger(__name__)
app = FastAPI()

WEBHOOK_SECRET = os.environ["SALES_AI_WEBHOOK_SECRET"]

def verify_signature(raw_body: bytes, signature: str, timestamp: str) -> bool:
    if not signature or not timestamp:
        return False
    try:
        if abs(time.time() - int(timestamp)) > 300:
            return False
    except ValueError:
        return False
    
    signed_payload = f"{timestamp}.{raw_body.decode('utf-8')}"
    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode(),
        signed_payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

async def process_completed_job(job_id: str, job_type: str, result: dict, workspace_id: str):
    """Process job results in the background. Called after 200 is returned."""
    try:
        if job_type == "prospect_discovery":
            prospects = result.get("prospects", [])
            logger.info(f"Processing {len(prospects)} prospects from job {job_id}")
            await write_prospects_to_crm(prospects, workspace_id)
            await notify_team_slack(job_id, len(prospects))
        
        elif job_type == "lead_discovery":
            leads = result.get("leads", [])
            await write_leads_to_database(leads, workspace_id)
        
        # Mark job as processed (idempotency — see next section)
        await mark_event_processed(f"job_{job_id}")
        
    except Exception as e:
        logger.error(f"Background processing failed for job {job_id}: {e}")
        # Don't re-raise — the 200 was already sent to Sales AI

@app.post("/webhooks/sales-ai")
async def receive_sales_ai_webhook(request: Request, background_tasks: BackgroundTasks):
    # 1. Get raw body BEFORE any parsing
    raw_body = await request.body()
    
    # 2. Verify signature FIRST — reject forged deliveries immediately
    signature  = request.headers.get("X-Sales-AI-Signature", "")
    timestamp  = request.headers.get("X-Sales-AI-Timestamp", "")
    if not verify_signature(raw_body, signature, timestamp):
        logger.warning(f"Invalid webhook signature from {request.client.host}")
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    # 3. Parse payload
    payload = json.loads(raw_body)
    event_id  = payload.get("event_id", "")
    event     = payload.get("event", "")
    
    # 4. Check for duplicate delivery (idempotency)
    if await is_event_already_processed(event_id):
        logger.info(f"Duplicate delivery of event {event_id}, acknowledging")
        return JSONResponse({"received": True, "duplicate": True})
    
    # 5. Acknowledge IMMEDIATELY — Sales AI has a delivery timeout
    # Offload processing to background task
    if event == "job.completed":
        background_tasks.add_task(
            process_completed_job,
            job_id=payload["job_id"],
            job_type=payload["job_type"],
            result=payload.get("result", {}),
            workspace_id=payload.get("workspace_id", "")
        )
    
    elif event == "job.failed":
        background_tasks.add_task(handle_job_failure, payload)
    
    # Return 200 in < 3 seconds
    return JSONResponse({"received": True})
```

**The critical rule:** Return `200` immediately and process in the background. As every webhook guide confirms — [FastAPI webhook patterns](https://blog.greeden.me/en/2026/04/07/a-practical-guide-to-safely-implementing-webhook-receiver-apis-in-fastapi-from-signature-verification-and-retry-handling-to-idempotency-and-asynchronous-processing/), [DEV Community best practices](https://dev.to/henry_hang/webhook-best-practices-retry-logic-idempotency-and-error-handling-27i3) — if your processing takes longer than the delivery timeout, Sales AI retries the webhook, and you process the same job twice.

---

## Retry Logic and What Happens on Failure

Sales AI retries failed webhook deliveries with exponential backoff if your endpoint:
- Returns a non-2xx status code
- Times out (no response within 30 seconds)
- Returns a 5xx (server error)

**Retry schedule:**
| Attempt | Delay after previous |
|---|---|
| 1 (original) | — |
| 2 | 30 seconds |
| 3 | 2 minutes |
| 4 | 10 minutes |
| 5 | 30 minutes |
| Dead letter | After attempt 5 fails |

After 5 failed attempts, the delivery is marked as permanently failed and lands in your dead letter log (visible in **Settings → Webhooks → Delivery History**). You can manually retry from the dashboard.

**What status codes tell Sales AI:**
- `200`/`201` — Success, stop retrying
- `400` — Bad request, don't retry (your handler rejected it)
- `401` — Unauthorised, don't retry (signature verification failed)
- `5xx` — Server error, retry (transient failure)
- Timeout — retry

Return `401` for signature failures (stops retries — a forged payload won't get better on retry). Return `503` if your database is temporarily down (triggers retry). Return `200` even if processing failed in the background — the acknowledgment is separate from whether you successfully processed the payload.

---

## Handling Duplicate Deliveries (Idempotency)

Sales AI guarantees **at-least-once delivery** — under failure conditions, a delivery may arrive more than once. Your handler must be idempotent: processing the same event twice must produce the same outcome as processing it once.

```python
# Idempotency store — use database or Redis
async def is_event_already_processed(event_id: str) -> bool:
    """Check if this event_id has been processed before."""
    result = await db.fetchone(
        "SELECT 1 FROM processed_webhook_events WHERE event_id = $1",
        event_id
    )
    return result is not None

async def mark_event_processed(event_id: str):
    """Record that this event has been processed."""
    await db.execute(
        """INSERT INTO processed_webhook_events (event_id, processed_at)
           VALUES ($1, NOW())
           ON CONFLICT (event_id) DO NOTHING""",
        event_id
    )

# Table schema
# CREATE TABLE processed_webhook_events (
#     event_id    TEXT PRIMARY KEY,
#     processed_at TIMESTAMPTZ DEFAULT NOW()
# );
# CREATE INDEX ON processed_webhook_events (event_id);
```

Use `event_id` (from `X-Sales-AI-Event-ID` header or payload `event_id` field) as your idempotency key. This ID is stable across retry attempts — the same delivery gets the same ID on every attempt.

---

## Testing Webhooks Locally

**Option 1: ngrok**
```bash
# Start your server
uvicorn main:app --port 8000

# In another terminal, expose it
ngrok http 8000
# Copy the https://xxx.ngrok.io URL and add it as your webhook endpoint in Settings
```

**Option 2: Trigger test deliveries**

In **Settings → Webhooks → Test**, select an event type and Sales AI sends a sample payload to your configured URL. This confirms your endpoint is reachable and your signature verification works before you process any real jobs.

**Option 3: Replay from Delivery History**

Every delivery attempt is logged under **Settings → Webhooks → Delivery History** — including the full request payload and your response. Failed deliveries can be manually replayed from the dashboard, which is useful for debugging without re-running the underlying job.

[Configure your webhook endpoint →](/docs/quickstart) · [Full API reference for webhooks →](/docs/api-reference)

---

## FAQ: Async Webhook Delivery

### How do webhook deliveries work?

When a Sales AI async job completes (or fails), Sales AI sends an HTTP `POST` request to your configured webhook URL with a JSON payload containing the event type, job ID, and results (for completed jobs) or error details (for failed jobs). The `X-Sales-AI-Signature` header contains an HMAC-SHA256 signature you verify to confirm the delivery is authentic. Respond with `200` within 30 seconds to acknowledge receipt.

### How do I verify webhook signatures?

Compute `HMAC-SHA256(webhook_secret, f"{timestamp}.{raw_body}")` and compare it to the `X-Sales-AI-Signature` header value (format: `sha256=<hex>`). Use `hmac.compare_digest()` for constant-time comparison. Verify the timestamp is within 5 minutes to prevent replay attacks. Always verify against the raw request body, not the parsed JSON. The signature is invalid if you modify the body before checking it.

### What happens if a webhook fails?

Sales AI retries failed deliveries (non-2xx responses or timeouts) with exponential backoff: 30 seconds, 2 minutes, 10 minutes, 30 minutes. After 5 failed attempts, the delivery is permanently marked as failed and appears in your delivery history for manual replay. Return `5xx` to trigger retry (transient errors) and `4xx` to stop retries (permanent failures like bad signatures).

### How is polling different from webhooks?

Polling: your code calls `GET /jobs/{id}` repeatedly until status is `completed` — active waiting that consumes requests. Webhooks: Sales AI calls your endpoint once when the job completes — passive notification with no wasted calls. Polling is simpler to implement (no public URL needed) and fine for development. Webhooks are more efficient at scale and the right choice for production pipelines processing more than a few jobs per week.

### Can I configure webhooks for background jobs?

Yes. In Sales AI workspace **Settings → Webhooks**, add your endpoint URL and select the events you want to receive (`job.completed`, `job.failed`, or `*` for all). Async jobs (`/sales/prospect`, `/sales/leads`) automatically send webhook deliveries to configured endpoints when they complete. You can configure multiple endpoints and different event filters per endpoint.

---

## Related Resources

- [Sales AI API Reference — webhooks and async jobs →](/docs/api-reference)
- [Async Sales Prospecting Tutorial →](/blog/sales-prospecting-api-async)
- [Complete AI Sales Pipeline →](/blog/add-ai-to-sales-workflow)
- [Stripe Webhook Signatures — industry standard reference](https://stripe.com/docs/webhooks/signatures)
- [DEV Community: Webhook Processing at Scale](https://dev.to/whoffagents/webhook-processing-at-scale-idempotency-signature-verification-and-async-queues-45b3)
- [DEV Community: Webhook Best Practices](https://dev.to/henry_hang/webhook-best-practices-retry-logic-idempotency-and-error-handling-27i3)
- [FastAPI Webhook Security Guide](https://blog.greeden.me/en/2026/04/07/a-practical-guide-to-safely-implementing-webhook-receiver-apis-in-fastapi-from-signature-verification-and-retry-handling-to-idempotency-and-asynchronous-processing/)
