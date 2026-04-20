# How to Run AI Sales Prospecting as an Async Background Job (No More Timeouts)

<!-- ============================================================
SEO METADATA
Title tag (60 chars): Async AI Sales Prospecting API: No More Timeouts Guide
Meta description (157 chars): Prospect discovery takes 60+ seconds. Here's the complete async pattern: submit a job, get an ID, poll for results or use webhooks. Full Python + TypeScript code inside.
Primary keyword: sales prospecting API async
Secondary keywords: async sales prospecting API, background job prospecting, sales prospect discovery API, API polling pattern sales
URL slug: /blog/sales-prospecting-api-async
Schema type: TechArticle + FAQPage + HowTo
============================================================ -->

**Published:** April 2026 | **Reading time:** 11 min | **Audience:** Backend developers building sales automation, API engineers

---

<!-- ============================================================
FEATURED IMAGE
Image gen prompt: Dark-mode technical flow diagram illustration. A horizontal async job lifecycle shown as a timeline from left to right. Stage 1 (left, blue): "POST /sales/prospect" — a developer laptop icon with a small JSON payload badge. Instant response badge shows "202 Accepted, job_id: job_01abc". Stage 2 (middle, purple): A floating background queue box with "job: running" status indicator spinning. Below it, a clock shows "45-90 seconds". Stage 3 (right, green): Two completion paths branch. Top path: "GET /jobs/{id} → status: completed" (polling icon). Bottom path: "Webhook: POST to your endpoint" (webhook delivery icon). Both converge at a final results card showing "25 prospects, ICP scored". Background: very dark charcoal. Electric blue + green accents. Clean editorial developer style. No people. 4K, 16:9.
Alt tag: Async sales prospecting API lifecycle diagram showing POST request returning job ID, background queue processing, and dual completion paths via polling or webhook delivery
============================================================ -->

---

> **The problem in one sentence:** AI prospect discovery takes 45–90 seconds. Synchronous HTTP calls time out. Here's the exact pattern — submit, get an ID, poll or webhook — with complete Python and TypeScript implementations you can drop into production today.

---

## Table of Contents

1. [Why Synchronous Prospecting Fails at Scale](#why-synchronous-fails)
2. [The Async Request-Reply Pattern Explained](#the-async-pattern)
3. [Step 1: Submit the Prospect Job](#step-1-submit)
4. [Step 2: Poll for Results (Python + TypeScript)](#step-2-poll)
5. [Step 3: Configure Webhooks for Production](#step-3-webhooks)
6. [Step 4: Handle Failures and Dead Letters](#step-4-failures)
7. [Complete Production Implementation](#complete-implementation)
8. [Scheduling Nightly Prospect Batches](#scheduling-nightly-batches)
9. [FAQ: Async Sales Prospecting API](#faq)

---

## Why Synchronous Prospecting Fails at Scale

Most sales prospecting automation starts the same way: a developer makes a synchronous POST call, waits for the response, and processes the results. This works fine for quick operations. Prospect discovery is not a quick operation.

AI prospect discovery involves multiple steps that compound in duration:
- Generating company candidates matching your ICP criteria
- Researching each candidate for signals and context
- Scoring each candidate against your ICP
- Building structured profiles for each result

For a batch of 25 prospects, this takes **45–90 seconds**. The typical HTTP timeout at the CDN, load balancer, or serverless function layer is **30 seconds**. The math doesn't work.

The consequences of getting this wrong in production:
- **Silent failures** — the job dies mid-run, you get nothing, no error
- **Duplicate submissions** — frustrated users retry, creating multiple half-completed jobs
- **Gateway timeouts** — 504 errors from Vercel, Cloudflare, AWS API Gateway
- **Serverless function limits** — AWS Lambda default timeout is 29 seconds, Vercel is 25

The correct solution is the **Async Request-Reply pattern** — a well-established API design pattern documented by the [Microsoft Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply) and the [AWS Architecture Blog](https://aws.amazon.com/blogs/architecture/managing-asynchronous-workflows-with-a-rest-api/).

<!-- ============================================================
IMAGE 1 — Timeout Failure vs Async Pattern
Image gen prompt: Dark-mode two-scenario diagram side by side. LEFT "Synchronous Approach (Fails)": a timeline bar from 0s to 90s. A red "TIMEOUT" vertical line appears at 30s, cutting through the bar. Labels: "0s: POST request sent", "30s: Gateway timeout", "45-90s: Where results would have been". Underneath, a broken chain icon labelled "Silent failure — no data returned". RIGHT "Async Pattern (Works)": same 0-90s timeline. At 0s: "POST → 202 Accepted (job_id)" green badge. A horizontal "Background Processing" bar runs from 0s to 75s in purple. At 75s: "Webhook received" or "Poll returns completed" green marker. No timeout line. Clean dark background. No people. 16:9.
Alt tag: Async sales prospecting API comparison showing synchronous timeout failure at 30 seconds versus async pattern with immediate 202 response and background processing to completion
============================================================ -->

---

## The Async Request-Reply Pattern Explained

The async request-reply pattern has three components:

**1. Submit (POST → 202 Accepted)**
The client sends a POST request. The server starts the background job and **immediately returns HTTP 202** with a `job_id` and a `poll_url`. No waiting. The client is free to do other work.

**2. Track (GET → 200/running or 200/completed)**
The client periodically calls the status endpoint with the `job_id`. The server returns the current status (`queued | running | completed | failed`). When status is `completed`, the results are in the response body.

**3. Deliver (Webhook OR Poll)**
Either the client keeps polling until completion, or the server sends a webhook POST to a configured URL when the job finishes — eliminating the need to poll at all.

As [Zuplo's guide to async REST APIs](https://zuplo.com/learning-center/asynchronous-operations-in-rest-apis-managing-long-running-tasks) puts it: *"Asynchronous REST APIs are essential when tasks take too long to process in real-time. Instead of making users wait, these APIs handle requests in the background and let users check the progress later."*

The Sales AI `/sales/prospect` and `/sales/leads` endpoints implement this pattern exactly.

---

## Step 1: Submit the Prospect Job

The submit call returns instantly — under 500ms — with a `job_id`:

```bash
# cURL example — returns immediately
curl -X POST https://api.sales-ai.app/api/v1/sales/prospect \
  -H "Authorization: Bearer $WORKSPACE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "criteria": "B2B SaaS, 50-200 employees, Series A or B, VP Sales or RevOps, evaluating CRM tools",
    "limit": 25
  }'
```

**Immediate response (< 500ms):**
```json
{
  "job_id": "job_01abc123def456",
  "status": "queued",
  "poll_url": "/api/v1/jobs/job_01abc123def456",
  "estimated_completion_seconds": 60
}
```

The response follows the [async job standard described by Tyk API Gateway](https://tyk.io/blog/moving-beyond-polling-to-async-apis/) — return HTTP 202 with a location reference immediately, process in the background.

**Python submit:**
```python
import requests

def submit_prospect_job(criteria: str, limit: int, workspace_key: str) -> str:
    """Submit a prospect discovery job. Returns job_id immediately."""
    response = requests.post(
        "https://api.sales-ai.app/api/v1/sales/prospect",
        headers={"Authorization": f"Bearer {workspace_key}"},
        json={"criteria": criteria, "limit": limit},
        timeout=10  # Short timeout — this call returns in <500ms
    )
    response.raise_for_status()
    job = response.json()
    print(f"Job submitted: {job['job_id']} (estimated: {job.get('estimated_completion_seconds', '?')}s)")
    return job["job_id"]

job_id = submit_prospect_job(
    criteria="B2B SaaS, 50-200 employees, Series A or B, VP Sales or RevOps",
    limit=25,
    workspace_key="your_workspace_key"
)
```

---

## Step 2: Poll for Results (Python + TypeScript)

### Python — Production-Grade Polling with Exponential Backoff

```python
import time
import requests
from typing import Optional

def poll_prospect_job(
    job_id: str,
    workspace_key: str,
    initial_delay: float = 5.0,
    max_delay: float = 30.0,
    max_attempts: int = 30,
    backoff_factor: float = 1.5
) -> list[dict]:
    """
    Poll a prospect job until completion.
    Uses exponential backoff to reduce unnecessary requests.
    """
    headers = {"Authorization": f"Bearer {workspace_key}"}
    delay = initial_delay
    
    for attempt in range(1, max_attempts + 1):
        time.sleep(delay)
        
        try:
            response = requests.get(
                f"https://api.sales-ai.app/api/v1/jobs/{job_id}",
                headers=headers,
                timeout=10
            )
            response.raise_for_status()
            status = response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"  Poll attempt {attempt} failed: {e} — retrying")
            delay = min(delay * backoff_factor, max_delay)
            continue
        
        state = status["status"]
        print(f"  Poll {attempt}/{max_attempts}: {state} ({delay:.1f}s interval)")
        
        if state == "completed":
            prospects = status["result"]["prospects"]
            print(f"  ✓ Completed — {len(prospects)} prospects found")
            return prospects
        
        elif state == "failed":
            error = status.get("error", "Unknown error")
            raise RuntimeError(f"Prospect job failed: {error}")
        
        elif state == "cancelled":
            raise RuntimeError("Prospect job was cancelled")
        
        # Still running (queued or running) — increase delay
        delay = min(delay * backoff_factor, max_delay)
    
    raise TimeoutError(f"Job {job_id} did not complete after {max_attempts} polls")


# Usage
prospects = poll_prospect_job(job_id, workspace_key="your_workspace_key")
```

**Why exponential backoff?** As [AWS's async workflow guide](https://aws.amazon.com/blogs/architecture/managing-asynchronous-workflows-with-a-rest-api/) explains: *"In the polling pattern, the client must decide how frequently to poll. One common choice is exponential backoff, which increases the interval between checks until a maximum interval is reached."* Starting at 5s and backing off to 30s avoids hammering the status endpoint while still catching completion quickly.

<!-- ============================================================
IMAGE 2 — Exponential Backoff Polling Timeline
Image gen prompt: Dark-mode timeline chart. X-axis: time in seconds (0 to 90s). Y-axis: "Poll interval". Shows a bar chart with polling attempts at: 5s, 7.5s, 11s, 16s, 24s, 30s, 30s (capped). Each bar is labelled with "Poll 1: queued", "Poll 2: running", etc. At 75s mark, the bar turns green and shows "Poll 7: COMPLETED". Below the timeline, a label "Total: 7 polls vs 90 polls at 1s fixed interval". Clean dark background, cyan bars, green completion marker. No people. 16:9.
Alt tag: Exponential backoff polling timeline for async sales prospecting API showing 7 polls over 75 seconds versus 90 polls at fixed 1-second intervals with completion marker
============================================================ -->

### TypeScript — Async/Await with Abort Controller

```typescript
interface ProspectJob {
  job_id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  result?: { prospects: Prospect[] };
  error?: string;
}

interface Prospect {
  company: string;
  title?: string;
  icp_score: number;
  research_summary: string;
}

async function pollProspectJob(
  jobId: string,
  workspaceKey: string,
  options = { initialDelay: 5000, maxDelay: 30000, maxAttempts: 30 }
): Promise<Prospect[]> {
  const headers = { Authorization: `Bearer ${workspaceKey}` };
  let delay = options.initialDelay;
  
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const response = await fetch(
      `https://api.sales-ai.app/api/v1/jobs/${jobId}`,
      { headers }
    );
    
    if (!response.ok) {
      console.error(`Poll ${attempt} failed: ${response.status}`);
      delay = Math.min(delay * 1.5, options.maxDelay);
      continue;
    }
    
    const status: ProspectJob = await response.json();
    console.log(`Poll ${attempt}: ${status.status}`);
    
    switch (status.status) {
      case "completed":
        console.log(`✓ ${status.result!.prospects.length} prospects found`);
        return status.result!.prospects;
      
      case "failed":
        throw new Error(`Job failed: ${status.error}`);
      
      case "cancelled":
        throw new Error("Job was cancelled");
      
      default:
        delay = Math.min(delay * 1.5, options.maxDelay);
    }
  }
  
  throw new Error(`Job ${jobId} timed out after ${options.maxAttempts} polls`);
}
```

---

## Step 3: Configure Webhooks for Production

Polling works well for one-off runs. For scheduled batches in production, webhooks eliminate the need to poll entirely. Configure a webhook URL in **Settings → Webhooks** — Sales AI POSTs to your endpoint when any job completes.

**FastAPI webhook receiver:**

```python
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import hmac
import hashlib
import json

app = FastAPI()

WEBHOOK_SECRET = "your_webhook_signing_secret"

def verify_signature(payload: bytes, signature: str) -> bool:
    """Verify the X-Sales-AI-Signature header."""
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)

@app.post("/webhook/sales-ai")
async def receive_sales_ai_webhook(request: Request):
    # Verify signature
    body = await request.body()
    signature = request.headers.get("X-Sales-AI-Signature", "")
    
    if not verify_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    payload = json.loads(body)
    
    if payload["event"] == "job.completed":
        job_id = payload["job_id"]
        prospects = payload["result"]["prospects"]
        
        print(f"Received {len(prospects)} prospects from job {job_id}")
        
        # Process prospects — write to DB, CRM, queue for enrichment
        await process_prospects(prospects)
    
    elif payload["event"] == "job.failed":
        print(f"Job {payload['job_id']} failed: {payload.get('error')}")
        await notify_team_of_failure(payload)
    
    return JSONResponse({"ok": True})
```

**Webhook payload shape:**
```json
{
  "event": "job.completed",
  "job_id": "job_01abc...",
  "result": {
    "prospects": [
      {
        "company": "DataFlow Inc",
        "title": "VP RevOps",
        "icp_score": 91,
        "research_summary": "Series B SaaS company, evaluating CRM stack...",
        "recent_signals": ["Raised Series B Q1 2026", "New VP Sales hire"]
      }
    ]
  },
  "timestamp": "2026-04-20T06:32:11Z"
}
```

Signature verification follows the same HMAC-SHA256 pattern used by [Stripe's webhook security model](https://stripe.com/docs/webhooks/signatures) — the industry standard for preventing webhook forgery.

---

## Step 4: Handle Failures and Dead Letters

Production async jobs fail. The right handling ensures you never silently lose a prospect batch.

**What Sales AI guarantees:**
- Failed jobs retry automatically with exponential backoff (up to 3 attempts)
- Jobs that exhaust retries land in a **dead-letter queue** (DLQ) — never silently dropped
- Your webhook receives a `job.failed` event if all retries are exhausted
- Jobs can be cancelled via `DELETE /jobs/{job_id}` at any point

**Your application-side failure handling:**

```python
async def submit_and_track_prospect_job(criteria: str, workspace_key: str) -> list[dict]:
    """
    Submit a prospect job with full failure handling.
    Returns prospects or raises a descriptive exception.
    """
    headers = {"Authorization": f"Bearer {workspace_key}"}
    
    try:
        # Submit
        r = requests.post(f"{BASE_URL}/sales/prospect",
            headers=headers,
            json={"criteria": criteria, "limit": 25},
            timeout=10
        )
        r.raise_for_status()
        job_id = r.json()["job_id"]
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 402:
            raise RuntimeError("Workspace has no active Anthropic key — add one under Settings")
        elif e.response.status_code == 429:
            raise RuntimeError("Rate limit exceeded — retry after 60 seconds")
        raise
    
    # Poll with timeout
    try:
        return poll_prospect_job(job_id, workspace_key)
    
    except TimeoutError:
        # Cancel the job to free up resources
        requests.delete(f"{BASE_URL}/jobs/{job_id}", headers=headers)
        raise RuntimeError(f"Prospect discovery timed out — job {job_id} cancelled")
    
    except RuntimeError as e:
        # Log job_id for debugging — include in any bug reports
        print(f"Job {job_id} failed permanently: {e}")
        raise
```

---

## Complete Production Implementation

Here is the full, production-ready async prospecting client:

```python
import requests
import time
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

@dataclass
class ProspectingConfig:
    workspace_key: str
    base_url: str = "https://api.sales-ai.app/api/v1"
    poll_initial_delay: float = 5.0
    poll_max_delay: float = 30.0
    poll_max_attempts: int = 30
    poll_backoff_factor: float = 1.5

class AsyncProspectingClient:
    
    def __init__(self, config: ProspectingConfig):
        self.config = config
        self.headers = {
            "Authorization": f"Bearer {config.workspace_key}",
            "Content-Type": "application/json"
        }
    
    def submit(self, criteria: str, limit: int = 25) -> str:
        """Submit job, return job_id immediately."""
        r = requests.post(
            f"{self.config.base_url}/sales/prospect",
            headers=self.headers,
            json={"criteria": criteria, "limit": limit},
            timeout=10
        )
        r.raise_for_status()
        job_id = r.json()["job_id"]
        logger.info(f"Submitted prospect job: {job_id}")
        return job_id
    
    def poll(self, job_id: str) -> list[dict]:
        """Poll until completion, return prospects."""
        delay = self.config.poll_initial_delay
        
        for attempt in range(1, self.config.poll_max_attempts + 1):
            time.sleep(delay)
            
            r = requests.get(
                f"{self.config.base_url}/jobs/{job_id}",
                headers=self.headers,
                timeout=10
            )
            status = r.json()
            logger.debug(f"Poll {attempt}: {status['status']}")
            
            if status["status"] == "completed":
                return status["result"]["prospects"]
            elif status["status"] in ("failed", "cancelled"):
                raise RuntimeError(f"Job {job_id} {status['status']}: {status.get('error')}")
            
            delay = min(delay * self.config.poll_backoff_factor, self.config.poll_max_delay)
        
        self.cancel(job_id)
        raise TimeoutError(f"Job {job_id} timed out")
    
    def cancel(self, job_id: str) -> None:
        """Cancel a running job."""
        requests.delete(
            f"{self.config.base_url}/jobs/{job_id}",
            headers=self.headers,
            timeout=10
        )
    
    def run(self, criteria: str, limit: int = 25) -> list[dict]:
        """Submit and poll — convenience method."""
        job_id = self.submit(criteria, limit)
        return self.poll(job_id)


# Usage
client = AsyncProspectingClient(ProspectingConfig(workspace_key="your_key"))

prospects = client.run(
    criteria="B2B SaaS, 50-200 employees, RevOps or sales leadership, Series A or B",
    limit=25
)
print(f"Found {len(prospects)} prospects")
```

---

## Scheduling Nightly Prospect Batches

The most effective use of async prospecting: run nightly and wake up to a fresh, ICP-scored prospect list.

```python
# cron_prospects.py — run via cron: 0 23 * * * python cron_prospects.py

import schedule
import time
from async_prospecting_client import AsyncProspectingClient, ProspectingConfig

def nightly_prospecting():
    client = AsyncProspectingClient(ProspectingConfig(workspace_key=os.environ["WORKSPACE_KEY"]))
    
    ICPs = [
        "B2B SaaS, 50-150 employees, Series A, VP Sales or Head of RevOps",
        "B2B SaaS, 150-500 employees, Series B, Director Sales Ops or RevOps Manager",
    ]
    
    for icp in ICPs:
        try:
            prospects = client.run(criteria=icp, limit=25)
            # Write to CRM, database, or Slack
            write_to_crm(prospects)
            print(f"✓ {len(prospects)} prospects for: {icp[:50]}...")
        except Exception as e:
            print(f"✗ Failed for ICP segment: {e}")

schedule.every().day.at("23:00").do(nightly_prospecting)

while True:
    schedule.run_pending()
    time.sleep(60)
```

[Start with the quickstart →](/docs/quickstart) · [Full API reference for /sales/prospect and /jobs →](/docs/api-reference)

---

## FAQ: Async Sales Prospecting API

### How do I automate prospecting with AI?

Submit a job to `POST /api/v1/sales/prospect` with your ICP criteria and a `limit`. You receive a `job_id` immediately. Poll `GET /api/v1/jobs/{job_id}` every 5–30 seconds until `status == "completed"`, or configure a webhook to receive results automatically. Results include ICP-scored companies with research summaries and signals.

### What's the best API for prospect discovery?

For structured, async prospect discovery with built-in ICP scoring, the Sales AI `/sales/prospect` endpoint returns 10–100 companies per job with scores, research summaries, and intent signals. BYOK — LLM costs bill to your Anthropic account. [See the full endpoint schema →](/docs/api-reference)

### How do I avoid timeout errors in sales automation?

Use async patterns: submit long-running tasks (prospect discovery, lead enrichment) as background jobs that return a job_id immediately. Poll with exponential backoff or use webhooks for production. The [Microsoft Azure async request-reply pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply) and [AWS async REST patterns](https://aws.amazon.com/blogs/architecture/managing-asynchronous-workflows-with-a-rest-api/) document this as the standard approach. Never call prospect discovery synchronously if it takes >25 seconds.

### How does async job polling work?

POST to submit the job → receive `job_id` in <500ms. GET `/jobs/{job_id}` repeatedly to check status (`queued → running → completed/failed`). When `completed`, the results are in the response body. Use exponential backoff (start at 5s, increase by 1.5x per poll, cap at 30s) to avoid excessive requests. Or configure a webhook to receive completion events instead.

### Can I get webhooks for prospect job results?

Yes. Configure a webhook URL in **Settings → Webhooks** in your Sales AI workspace. When any async job completes, Sales AI POSTs a `job.completed` event to your endpoint with the full results. Includes `X-Sales-AI-Signature` HMAC header for verification. Failed deliveries retry with exponential backoff.

---

## Related Resources

- [Sales AI API Reference — /sales/prospect + /jobs endpoints →](/docs/api-reference)
- [Complete AI Sales Pipeline Tutorial →](/blog/add-ai-to-sales-workflow)
- [Sales AI API Overview — all 15 endpoints →](/blog/sales-ai-api)
- [Microsoft Azure Async Request-Reply Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply)
- [AWS Architecture: Async REST API Workflows](https://aws.amazon.com/blogs/architecture/managing-asynchronous-workflows-with-a-rest-api/)
- [Zuplo: Asynchronous REST API Operations](https://zuplo.com/learning-center/asynchronous-operations-in-rest-apis-managing-long-running-tasks)
- [Tyk: Moving Beyond Polling to Async APIs](https://tyk.io/blog/moving-beyond-polling-to-async-apis/)
- [Stripe Webhook Signature Verification](https://stripe.com/docs/webhooks/signatures)

---
<!-- SCHEMA: TechArticle + FAQPage + HowTo (4-step async pattern) -->
