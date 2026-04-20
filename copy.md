# Sales AI — Full Website Copy
*All pages. Ready to implement.*
*Voice: Confident, technical, no-fluff. Developer-first.*


## Homepage Copy

*Voice: Confident, technical, no-fluff. Developer-first.*

---

### 🔼 HERO — Above the Fold

---

**Headline (3 options):**

**A (recommended):** `15 Sales AI Endpoints. Your Key. Your Costs.`
*Why: Leads with the product's depth (15 endpoints), immediately names the differentiator (BYOK). Triplet rhythm is scannable. Developers stop here.*

**B:** `The Sales AI API for Teams That Build.`
*Why: Identity-based — positions this as the developer-first choice. Works if you want to attract builders/agencies.*

**C:** `Stop Building Sales AI from Scratch.`
*Why: Problem-first. Speaks directly to the pain of rolling your own LLM pipelines. Pairs well with paid traffic from developer communities.*

---

**Subheadline:**
`15 production-ready sales endpoints. Call from cURL, Python, TypeScript, JavaScript, Go, PHP, or Ruby. Full BYOK — your Anthropic key hits your account, not ours.`

*Why: Fixes the truncated language list from the audit. The final clause "not ours" sharpens the BYOK benefit — it's not just ownership, it's explicit cost separation.*

---

**Primary CTA:** `Connect Your Key`
**Secondary CTA:** `Browse the Docs`

*Why: "Connect Your Key" maps directly to the BYOK mental model — the first real action is connecting their Anthropic key, not a generic "get started." Secondary CTA goes to public docs, not another login wall.*

---

**Social proof bar (below CTAs):**
`Built on Render · Vercel · Supabase` *(small, inline — credibility signal for technical buyers)*

---

### ⚡ CODE SNIPPET SECTION

*Right below the hero. No section header needed — the code speaks.*

```python
# Qualify a lead in one API call
import requests

r = requests.post(
    "https://api.sales-ai.app/api/v1/sales/qualify",
    headers={"Authorization": "Bearer YOUR_APP_KEY"},
    json={"lead": "Acme Corp, 500 employees, Series B, uses Salesforce"}
)
print(r.json())
# → { score: 87, tier: "A", reasoning: "...", next_action: "..." }
```

*[Tab switcher: cURL · Python · TypeScript · Go · PHP · Ruby]*

**Caption beneath:**
`Every endpoint returns structured JSON. Plug it into any CRM, automation, or workflow.`

*Why: This is the fastest way to qualify a developer. The fake response output (`score: 87, tier: "A"`) shows the shape of the data without needing a live demo. The tab switcher hints at the 7-language depth.*

---

### 🧱 FEATURE CARDS — 3-column

---

**Card 1**
**Your LLM costs stay yours**
Use your own Anthropic API key. Every token you spend hits your account directly — we see nothing, mark up nothing. No shared keys, no hidden per-call fees, no vendor lock-in.
*[Icon: key]*

---

**Card 2**
**Production code in your language, ready to paste**
Copy verified snippets in cURL, Python, TypeScript, JavaScript, Go, PHP, or Ruby. Not boilerplate — actual working calls to live endpoints.
*[Icon: code brackets]*

---

**Card 3**
**Long jobs don't fail**
Prospect and lead discovery run async in a background queue. Poll for results or configure webhooks. No 30-second timeouts killing your pipeline runs.
*[Icon: clock/queue]*

---

### 📊 STATS BAR

```
15          7              Async          AES-256-GCM
Production  Languages      Job queue      Key encryption
endpoints   supported      with polling
```

---

### 🗂️ ENDPOINT GRID — "15 Sales Skills. All Callable in Minutes."

**Section header:** `15 Sales Skills. All Callable in Minutes.`

**Section subheader:** `Every endpoint is purpose-built for one job. Structured inputs, structured outputs. Wire them into whatever stack you already have.`

*[3-column card grid — each card shows endpoint + one-line description]*

| Endpoint | What it does |
|---|---|
| `/sales/research` | Deep prospect research before a call |
| `/sales/qualify` | Lead scoring and qualification |
| `/sales/outreach` | Personalized outreach copy, first touch |
| `/sales/followup` | Multi-step follow-up sequences |
| `/sales/prep` | Pre-call meeting prep and briefing |
| `/sales/proposal` | Proposal generation from context |
| `/sales/objections` | Objection handling library, deal-specific |
| `/sales/icp` | ICP fit scoring and gap analysis |
| `/sales/competitors` | Competitive intelligence on demand |
| `/sales/contacts` | Contact enrichment and profiling |
| `/sales/prospect` | Async prospect discovery (job queue) |
| `/sales/leads` | Async lead discovery (job queue) |
| `/sales/report` | Sales performance reporting |
| `/sales/report-pdf` | PDF report export |
| `/sales/quick` | Fast sales queries, no queue |

*[CTA below grid]: `See full request/response schemas →` (links to API reference)*

---

### 🔒 TRUST / SECURITY STRIP

**Header:** `Security built for the way you work`

Three columns:

**Encrypted at rest**
Your Anthropic key is encrypted with AES-256-GCM before it ever touches our database. We can't read it. Neither can anyone else.

**Tenant isolation**
Every workspace runs behind row-level security in Supabase Postgres. Your data is invisible to every other org.

**Operational hardening**
Scoped API keys, request IDs, rate limiting, audit logs, retry logic, and a dead-letter queue for failed jobs.

*[Link]: Full security details →*

---

### 🤔 OBJECTION SECTION — "Questions developers actually ask"

**Why not just call Anthropic directly?**
You could. But you'd spend weeks building 15 sales-specific prompt layers, structuring outputs, wiring up an async job queue, and handling failures. We've done that. You get stable endpoints with clean schemas from day one.

**Who controls my Anthropic costs?**
You do, entirely. Your key hits Anthropic directly — we have no visibility into your token spend and charge nothing on top. We charge for platform access, not AI usage.

**What if I need a language you don't support?**
We ship snippets for cURL, Python, TypeScript, JavaScript, Go, PHP, and Ruby. If it can make an HTTP request, it can call the API. If your language isn't listed, the raw REST spec works from anywhere.

**Is this for enterprises or startups?**
Both. Starter is a single workspace for builders and small teams. Growth adds multi-workspace support and webhooks for scaling teams and agencies. Enterprise brings SSO/SAML and compliance exports.

---

### 🚀 FINAL CTA SECTION

**Header:** `Start in the time it takes to read the docs`

**Body:**
Sign up, connect your Anthropic key, and make your first `/sales/qualify` call. No lengthy onboarding, no waiting for access, no setup calls.

**Primary CTA:** `Connect Your Key`
**Secondary:** `Read the quickstart →`

**Risk-reversal line:** *Your Anthropic key stays encrypted. You control what you spend.*

---

---

## Pricing Page Rewrite

---

**Page headline:** `Simple Pricing. Your LLM Costs Stay Separate.`

**Subheadline:** `Pay for platform access. Everything your Anthropic key spends goes directly to Anthropic — not us.`

---

**[Starter]** *(Recommended plan indicator)*
For individual builders and small teams.
- Single workspace
- All 15 endpoints
- Full BYOK key management
- Async job queue
- 7-language code snippets
- OpenAPI spec access

**`[INSERT PRICE]`/mo**
`Connect Your Key — free to start`

---

**[Growth]**
For scaling teams and agencies managing multiple clients.
- Everything in Starter
- Multi-workspace support
- Advanced usage analytics per endpoint
- Webhook delivery for async jobs
- Usage breakdowns by key

**`[INSERT PRICE]`/mo**
`Start Growth Trial`

---

**[Enterprise]** *(Coming in v1.1)*
For teams with compliance requirements.
- Everything in Growth
- SSO / SAML
- Compliance exports
- Audit stream integration
- Dedicated support

`Talk to us`

---

**Below pricing table:**

**"What am I actually paying for?"**
Your subscription covers access to the Sales AI platform — the 15 endpoints, the async infrastructure, workspace management, and usage tracking. Your Anthropic API costs are billed separately, directly by Anthropic, to your account. We never see or touch that spend.

---

### Annotations on Key Decisions

**"Connect Your Key" CTA over "Get Started"** — The first real action for every user is connecting their Anthropic key. The CTA names that action. It sets accurate expectations and filters in the right audience (people who already have a key or are ready to get one).

**Code snippet in the hero section** — Developer conversion happens when they see the product working, not when they read about it. The snippet shows the API is clean and the output is structured. The tab switcher signals breadth without listing all 7 languages in prose.

**"15 Sales Skills" as the section header** — Framing endpoints as "skills" shifts perception from "API calls" to "capabilities I'm buying." It's the same product, but the mental model is more value-dense.

**Pricing page subheadline calling out the billing split** — The #1 confusion point for BYOK products is "what am I paying for?" Addressing it before the plan comparison reduces anxiety and increases the signal-to-noise ratio of the decision.


---

## PAGE: /product

### HERO

**Headline:** `Everything a Sales Team Needs. Callable from Your Code.`

**Subheadline:**
`Sales AI is a REST API with 15 purpose-built endpoints covering the full sales cycle — research, qualify, outreach, proposals, objections, competitive intel, and more. Bring your own Anthropic key. Wire it into whatever you already use.`

**Primary CTA:** `Connect Your Key`
**Secondary CTA:** `View API Reference →`

---

### SECTION 1: REST Skill Engine

**Header:** `One base URL. Fifteen sales skills.`

**Body:**
Every endpoint in the `POST /api/v1/sales/*` namespace is built for one specific sales job. Structured JSON in, structured JSON out. No prompt engineering on your end, no ambiguous responses to parse.

Authenticate with a Bearer token from your workspace. Call from any HTTP client. The OpenAPI spec lives at `/api/v1/openapi.json` — drop it into Postman, Insomnia, or your IDE and you're building in minutes.

**Code block:**
```bash
curl -X POST https://api.sales-ai.app/api/v1/sales/research \
  -H "Authorization: Bearer YOUR_APP_KEY" \
  -H "Content-Type: application/json" \
  -d '{"company": "Acme Corp", "context": "B2B SaaS, Series B, uses Salesforce"}'
```

**Caption:** `Every endpoint returns a consistent JSON envelope. Parse it, store it, pass it downstream.`

---

### SECTION 2: The 15 Endpoints — Grouped by Use

**Header:** `Built for the full sales cycle`

**Subheader:** `Not generic completions. Purpose-built endpoints, each returning structured data your code can act on.`

#### Prospecting & Intelligence
| Endpoint | What it does |
|---|---|
| `/sales/research` | Deep-dive company and contact research before a call |
| `/sales/prospect` | Async batch prospect discovery — runs in background queue |
| `/sales/leads` | Async lead discovery with polling and cancel support |
| `/sales/icp` | ICP fit scoring and gap analysis for any lead |
| `/sales/competitors` | Competitive positioning and battlecard generation |

#### Outreach & Sequencing
| Endpoint | What it does |
|---|---|
| `/sales/outreach` | Personalized first-touch outreach copy |
| `/sales/followup` | Multi-step follow-up sequence generation |
| `/sales/contacts` | Contact enrichment and profile building |

#### Deal Execution
| Endpoint | What it does |
|---|---|
| `/sales/qualify` | Lead scoring and qualification with reasoning |
| `/sales/prep` | Pre-call meeting briefing and talk track |
| `/sales/objections` | Deal-specific objection handling library |
| `/sales/proposal` | Full proposal generation from context |

#### Reporting & Utilities
| Endpoint | What it does |
|---|---|
| `/sales/report` | Sales performance reporting and analysis |
| `/sales/report-pdf` | PDF report export, ready to send |
| `/sales/quick` | Fast sales queries — no async queue, instant response |

**CTA below table:** `See full request/response schemas in the API Reference →`

---

### SECTION 3: Queue + Polling Jobs

**Header:** `Long-running jobs don't fail. They queue.`

**Body:**
Prospect discovery and lead research are intensive. They can take 30–90 seconds, blow through serverless timeouts, and fail silently if you call them synchronously.

The `/sales/prospect` and `/sales/leads` endpoints submit jobs to a background queue. You get a `job_id` back immediately. Poll `/jobs/{id}` for status, or configure a webhook to receive results when the job completes. Cancel any job mid-run with a `DELETE` call.

No timeouts. No silent failures. Results are there when the job is done.

**Code block:**
```python
# Submit the job
job = requests.post(".../sales/prospect", json={"criteria": "..."})
job_id = job.json()["job_id"]

# Poll for completion
while True:
    status = requests.get(f".../jobs/{job_id}").json()
    if status["state"] == "completed":
        results = status["result"]
        break
    time.sleep(3)
```

---

### SECTION 4: Usage Intelligence

**Header:** `Know exactly what you're spending — and where.`

**Body:**
Every API call is tracked against your workspace. The usage dashboard shows token counts, response durations, model versions used, and consumption broken down by endpoint and API key.

You're not flying blind on costs. When Anthropic bills your key, you can trace every dollar back to which endpoint, which call, which workspace triggered it.

**Three stat cards:**
- **Per-endpoint tracking** — See which skills cost the most
- **Per-key breakdown** — Separate usage across teams or clients
- **Model version logging** — Know exactly which model handled each call

---

### SECTION 5: Integration-Ready

**Header:** `It's HTTP. It goes everywhere.`

**Body:**
Sales AI doesn't care what you're building on. It's a REST API — if your stack can make an HTTP request, it can call Sales AI. Verified code snippets ship for 7 languages out of the box:

`cURL · Python · TypeScript · JavaScript · Go · PHP · Ruby`

Wire it into:
- **Your CRM** — Salesforce, HubSpot, Pipedrive via Zapier, n8n, or direct API
- **Your outbound stack** — Instantly, Lemlist, Apollo sequences enriched by AI
- **Your internal tools** — Internal dashboards, Notion, Slack bots, custom CLIs
- **Your SaaS product** — Ship AI sales features to your own customers

**CTA:** `Connect Your Key and Make Your First Call →`

---

---

## PAGE: /security

### HERO

**Headline:** `Your Key Never Leaves Your Control.`

**Subheadline:**
`You're trusting us with your Anthropic API key. We take that seriously. Here's exactly how it's protected — every step of the way.`

---

### SECTION 1: Credential Safety

**Header:** `Your Anthropic key is encrypted before it's stored. Always.`

**Body:**
When you add your Anthropic API key to Sales AI, it's encrypted with AES-256-GCM before it's written to the database. The plaintext key is never logged, never exposed in API responses, and never accessible to our team.

When a request fires, the key is decrypted in memory, used for the call, and immediately discarded. It exists as plaintext for milliseconds — never at rest.

**What this means for you:** Even in a worst-case breach scenario, an attacker who accessed the database would find encrypted ciphertext, not your key.

**Security detail card:**
```
Algorithm:    AES-256-GCM
Key storage:  Encrypted at rest, Supabase Postgres
Plaintext:    Never logged, never exposed, decrypted in-memory only
Access:       Zero — Anthropic bills your account directly, we never see usage
```

---

### SECTION 2: Tenant Isolation

**Header:** `Your data is invisible to every other workspace. Architecturally.`

**Body:**
Every workspace in Sales AI operates behind Row-Level Security (RLS) policies in Supabase Postgres. RLS isn't a feature we turned on — it's baked into the data model. Every query, at the database level, is automatically scoped to the requesting organization.

No cross-tenant data leaks. No relying on application-layer filters that can have bugs. Isolation at the lowest possible layer.

**Three-column breakdown:**
| Layer | Protection |
|---|---|
| Database | RLS policies on every tenant table |
| API | Org/workspace scoping on every authenticated request |
| Keys | Scoped API keys — limit by endpoint, workspace, or role |

---

### SECTION 3: Operational Hardening

**Header:** `Production-grade infrastructure, not an afterthought.`

**Body:**
Every request through Sales AI is designed for traceability and resilience:

**Request IDs** — Every API call returns a unique `x-request-id`. If something goes wrong, you have a handle to trace the exact request across every system log.

**Audit Logs** — Key creation, key rotation, workspace changes, and permission updates are all logged with actor, timestamp, and IP.

**Scoped API Keys** — Mint keys scoped to specific endpoints or workspaces. Give your CRM integration a key that can only call `/sales/qualify`. Rotate without touching your other integrations.

**Rate Limiting** — Per-key rate limits prevent runaway loops from burning through your Anthropic budget.

**Retry Logic + DLQ** — Failed async jobs retry with exponential backoff. Jobs that exhaust retries land in a dead-letter queue — never silently dropped.

---

### SECTION 4: Your Cost Isolation

**Header:** `We can't run up your Anthropic bill. By design.`

**Body:**
Your Anthropic API key connects directly to your Anthropic account. Every token you spend is billed by Anthropic to you — Sales AI sits between you and the model, but we never proxy billing. We have zero visibility into your token usage or spend.

This isn't just a policy. It's how the architecture works.

**CTA:** `Questions about security? Talk to us →`

---

### SECTION 5: Responsible Disclosure

**Header:** `Found something? Tell us.`

**Body:**
We take vulnerability reports seriously. If you find a security issue — in the API, the dashboard, or the infrastructure — please reach out directly before disclosing publicly. We'll acknowledge within 24 hours and work with you on a coordinated disclosure timeline.

**Contact:** `security@[yourdomain].com`

---

---

## PAGE: /docs (Landing)

### HERO

**Headline:** `Go from zero to first API call in under 10 minutes.`

**Subheadline:**
`Pick a path below. Most developers start with the Quickstart, get a working call in minutes, then use the API Reference to explore the full endpoint catalog.`

---

### NAVIGATION CARDS (3)

**Card 1: Quickstart**
**Header:** `Quickstart`
**Body:** Provision a workspace, connect your Anthropic key, set a model policy, and fire your first `/sales/qualify` call. Start here.
**CTA:** `Start the Quickstart →`

---

**Card 2: API Reference**
**Header:** `API Reference`
**Body:** Full endpoint catalog — request schemas, response envelopes, auth contracts, async job lifecycle, error codes, and rate limit headers.
**CTA:** `Browse the API →`

---

**Card 3: OAuth 2.1 Setup**
**Header:** `OAuth 2.1 Setup`
**Body:** Building a multi-tenant app on top of Sales AI? This guide covers the Supabase OAuth server integration, consent route implementation, and token flow.
**CTA:** `OAuth Setup Guide →`

---

### QUICK LINKS STRIP (below cards)

`OpenAPI JSON spec` · `Postman Collection` · `Status Page` · `Changelog`

---

---

## PAGE: /docs/quickstart

### PAGE HEADER

**Title:** `Quickstart`
**Subtitle:** `Provision a workspace, connect your Anthropic key, and make your first API call. This takes about 10 minutes.`

---

### STEP 1: Create Your Workspace

Sign up at [sales-ai-web-eta.vercel.app/login](https://sales-ai-web-eta.vercel.app/login). After email verification, you'll land in the workspace creation flow.

Your workspace is your isolated environment — it has its own API keys, usage tracking, and settings. On the Starter plan you get one. Growth adds multiple.

Give it a name (usually your company or project name) and hit **Create Workspace**.

---

### STEP 2: Connect Your Anthropic Key

Navigate to **Settings → API Keys → Add Anthropic Key**.

Paste your Anthropic API key. It's encrypted with AES-256-GCM before being stored — the plaintext is never logged. [How key storage works →](/security)

Don't have an Anthropic key yet? Get one at [console.anthropic.com](https://console.anthropic.com).

---

### STEP 3: Set Your Model Policy

Under **Settings → Model Policy**, choose which Claude model your endpoints will use. This applies globally to your workspace unless overridden per-request.

We recommend starting with `claude-sonnet-4-20250514` — it balances quality and cost well across all 15 endpoints.

You can override the model on any individual request by passing `model` in the request body.

---

### STEP 4: Mint a Workspace API Key

Navigate to **Settings → Workspace Keys → Create Key**.

This is the Bearer token you'll use to authenticate requests to Sales AI. It's separate from your Anthropic key — it authenticates you to our API, not to Anthropic.

Copy it now. It won't be shown again.

---

### STEP 5: Make Your First Call

Fire a `/sales/qualify` call — it's the simplest endpoint to test with.

**cURL:**
```bash
curl -X POST https://api.sales-ai.app/api/v1/sales/qualify \
  -H "Authorization: Bearer YOUR_WORKSPACE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lead": "Acme Corp, 500 employees, Series B SaaS, currently using HubSpot"
  }'
```

**Python:**
```python
import requests

response = requests.post(
    "https://api.sales-ai.app/api/v1/sales/qualify",
    headers={"Authorization": "Bearer YOUR_WORKSPACE_KEY"},
    json={"lead": "Acme Corp, 500 employees, Series B SaaS, currently using HubSpot"}
)
print(response.json())
```

**Expected response:**
```json
{
  "status": "success",
  "data": {
    "score": 84,
    "tier": "A",
    "reasoning": "Series B company with existing CRM investment signals budget and intent...",
    "recommended_next_action": "Schedule discovery call, lead with ROI angle",
    "disqualifiers": []
  },
  "meta": {
    "model": "claude-sonnet-4-20250514",
    "tokens_used": 312,
    "duration_ms": 1840,
    "request_id": "req_01abc..."
  }
}
```

---

### What's Next

- **Explore all 15 endpoints** in the [API Reference →](/docs/api-reference)
- **Run async jobs** — try `/sales/prospect` or `/sales/leads` for background processing
- **Track usage** in your workspace dashboard
- **Add team members or workspaces** if you're on Growth

---

---

## PAGE: /docs/api-reference

### PAGE HEADER

**Title:** `API Reference`
**Subtitle:** `Base URL: https://api.sales-ai.app/api/v1 · Auth: Authorization: Bearer <workspace_key> · OpenAPI: /api/v1/openapi.json`

---

### AUTHENTICATION

All requests require a workspace API key passed as a Bearer token:

```
Authorization: Bearer YOUR_WORKSPACE_KEY
```

Workspace keys are minted in **Settings → Workspace Keys**. You can create multiple scoped keys — for different environments, integrations, or permission levels.

**Error codes:**
- `401 Unauthorized` — Missing or invalid token
- `403 Forbidden` — Valid token, insufficient scope
- `429 Too Many Requests` — Rate limit exceeded. Check `X-RateLimit-Remaining` header.

---

### RESPONSE ENVELOPE

Every endpoint returns the same outer structure:

```json
{
  "status": "success" | "error",
  "data": { ... },           // Endpoint-specific payload
  "meta": {
    "model": "claude-sonnet-4-20250514",
    "tokens_used": 312,
    "duration_ms": 1840,
    "request_id": "req_01abc..."
  },
  "error": null              // Populated on error responses
}
```

The `meta.request_id` is your handle for support or debugging. Include it in any bug reports.

---

### SYNCHRONOUS ENDPOINTS

These endpoints return results immediately. Typical response times: 1–8 seconds depending on model and prompt complexity.

---

#### POST /sales/quick
Fast sales query. No queue. Ideal for simple lookups and short-form outputs.

**Request:**
```json
{
  "query": "string",        // Required. The sales question or task.
  "context": "string",      // Optional. Background context.
  "model": "string"         // Optional. Overrides workspace model policy.
}
```

**Response `data`:**
```json
{
  "answer": "string",
  "confidence": "high" | "medium" | "low"
}
```

---

#### POST /sales/research
Deep prospect or company research. Returns structured intelligence for pre-call prep or enrichment pipelines.

**Request:**
```json
{
  "company": "string",      // Required. Company name or domain.
  "contact": "string",      // Optional. Contact name or title.
  "context": "string"       // Optional. What angle to research.
}
```

**Response `data`:**
```json
{
  "company_summary": "string",
  "recent_news": ["string"],
  "tech_stack_signals": ["string"],
  "pain_point_hypotheses": ["string"],
  "conversation_hooks": ["string"]
}
```

---

#### POST /sales/qualify
Lead scoring and qualification with explicit reasoning.

**Request:**
```json
{
  "lead": "string",         // Required. Lead description or structured data.
  "icp": "string"           // Optional. Your ICP definition for scoring context.
}
```

**Response `data`:**
```json
{
  "score": 0-100,
  "tier": "A" | "B" | "C" | "D",
  "reasoning": "string",
  "recommended_next_action": "string",
  "disqualifiers": ["string"]
}
```

---

#### POST /sales/outreach
Personalized first-touch outreach copy.

**Request:**
```json
{
  "prospect": "string",     // Required. Who you're reaching out to.
  "context": "string",      // Optional. Product context, value prop, angle.
  "channel": "email" | "linkedin" | "sms"  // Optional. Default: email.
}
```

**Response `data`:**
```json
{
  "subject": "string",      // Email subject (if channel: email)
  "body": "string",
  "follow_up_hook": "string"
}
```

---

#### POST /sales/followup
Multi-step follow-up sequence generation.

**Request:**
```json
{
  "prospect": "string",
  "original_outreach": "string",  // Optional. Previous message for continuity.
  "steps": 2-5                    // Optional. Number of follow-ups. Default: 3.
}
```

**Response `data`:**
```json
{
  "sequence": [
    {
      "step": 1,
      "delay_days": 3,
      "subject": "string",
      "body": "string"
    }
  ]
}
```

---

#### POST /sales/prep
Pre-call meeting briefing and talk track.

**Request:**
```json
{
  "company": "string",
  "contact": "string",
  "meeting_type": "discovery" | "demo" | "negotiation" | "renewal",
  "context": "string"       // Optional. What you know so far.
}
```

**Response `data`:**
```json
{
  "briefing": "string",
  "key_questions": ["string"],
  "talk_track": "string",
  "watch_outs": ["string"]
}
```

---

#### POST /sales/proposal
Full proposal generation.

**Request:**
```json
{
  "company": "string",
  "problem": "string",
  "solution": "string",
  "pricing": "string",      // Optional.
  "context": "string"       // Optional.
}
```

**Response `data`:**
```json
{
  "executive_summary": "string",
  "problem_statement": "string",
  "proposed_solution": "string",
  "investment": "string",
  "next_steps": "string"
}
```

---

#### POST /sales/objections
Objection handling library, deal-specific.

**Request:**
```json
{
  "objection": "string",    // Required. The objection as stated.
  "context": "string"       // Optional. Deal context, product, prospect.
}
```

**Response `data`:**
```json
{
  "reframe": "string",
  "response": "string",
  "proof_points": ["string"],
  "follow_up_question": "string"
}
```

---

#### POST /sales/icp
ICP fit scoring and gap analysis.

**Request:**
```json
{
  "lead": "string",
  "icp_definition": "string"  // Required. Your ICP criteria.
}
```

**Response `data`:**
```json
{
  "fit_score": 0-100,
  "matching_criteria": ["string"],
  "gaps": ["string"],
  "recommendation": "string"
}
```

---

#### POST /sales/competitors
Competitive intelligence and positioning.

**Request:**
```json
{
  "competitor": "string",
  "context": "string"       // Optional. Your product, deal stage, prospect.
}
```

**Response `data`:**
```json
{
  "competitor_summary": "string",
  "their_strengths": ["string"],
  "their_weaknesses": ["string"],
  "your_differentiators": ["string"],
  "battle_card": "string"
}
```

---

#### POST /sales/contacts
Contact enrichment and profile building.

**Request:**
```json
{
  "contact": "string",      // Name, title, or LinkedIn URL.
  "company": "string"
}
```

**Response `data`:**
```json
{
  "profile_summary": "string",
  "role_context": "string",
  "likely_priorities": ["string"],
  "engagement_tips": ["string"]
}
```

---

#### POST /sales/report
Sales performance reporting and analysis.

**Request:**
```json
{
  "data": "string | object", // Required. Pipeline data, metrics, or raw notes.
  "period": "string",        // Optional. e.g. "Q2 2025"
  "format": "narrative" | "structured"  // Optional. Default: structured.
}
```

**Response `data`:**
```json
{
  "summary": "string",
  "highlights": ["string"],
  "concerns": ["string"],
  "recommendations": ["string"]
}
```

---

#### POST /sales/report-pdf
PDF report export. Returns a base64-encoded PDF.

**Request:** Same schema as `/sales/report`.

**Response `data`:**
```json
{
  "pdf_base64": "string",
  "filename": "string"
}
```

---

### ASYNC ENDPOINTS

These endpoints submit jobs to a background queue and return a `job_id` immediately. Use the Jobs API to poll for results or configure webhooks.

---

#### POST /sales/prospect
Async prospect discovery. Discovers and profiles prospects matching your criteria.

**Request:**
```json
{
  "criteria": "string",     // Required. ICP, industry, role, signals, etc.
  "limit": 10-100,          // Optional. Max prospects to return. Default: 25.
  "context": "string"       // Optional.
}
```

**Response (immediate):**
```json
{
  "job_id": "job_01abc...",
  "status": "queued",
  "poll_url": "/api/v1/jobs/job_01abc..."
}
```

---

#### POST /sales/leads
Async lead discovery. Similar to `/sales/prospect` but focused on inbound signals and buying intent.

**Request:**
```json
{
  "criteria": "string",
  "signals": ["string"],    // Optional. Intent signals to prioritize.
  "limit": 10-100
}
```

**Response (immediate):** Same envelope as `/sales/prospect`.

---

### JOBS API

#### GET /jobs/{job_id}
Poll for async job status.

**Response:**
```json
{
  "job_id": "string",
  "status": "queued" | "running" | "completed" | "failed" | "cancelled",
  "created_at": "ISO8601",
  "completed_at": "ISO8601 | null",
  "result": { ... },        // Populated when status: completed
  "error": "string | null"  // Populated when status: failed
}
```

#### DELETE /jobs/{job_id}
Cancel a running or queued job.

**Response:**
```json
{
  "job_id": "string",
  "status": "cancelled"
}
```

---

### WEBHOOKS

Configure a webhook URL in **Settings → Webhooks** to receive job completion events instead of polling.

**Payload:**
```json
{
  "event": "job.completed" | "job.failed",
  "job_id": "string",
  "result": { ... },
  "timestamp": "ISO8601"
}
```

Webhook requests include an `X-Sales-AI-Signature` header for verification. [Webhook verification guide →]

---

---

## PAGE: /docs/oauth

### PAGE HEADER

**Title:** `OAuth 2.1 Setup`
**Subtitle:** `Building a multi-tenant product on top of Sales AI? This guide covers connecting your Supabase OAuth server, implementing the consent route, and managing tokens.`

---

### WHO THIS IS FOR

This guide is for developers building SaaS products or internal tools that need to authenticate multiple users against Sales AI — where each user has their own Anthropic key and workspace.

If you're connecting Sales AI to your own app (not building on top of it), you don't need OAuth. Just mint a workspace API key and call the REST API directly.

---

### OVERVIEW

Sales AI uses OAuth 2.1 with PKCE via Supabase Auth. The flow:

1. Your app redirects the user to the Sales AI consent route
2. The user approves access and authenticates
3. Sales AI redirects back with an authorization code
4. Your server exchanges the code for an access token
5. Use the token to make API calls on behalf of that user

---

### STEP 1: Register Your OAuth Client

In **Settings → Developer → OAuth Apps**, create a new OAuth client.

You'll need to provide:
- **App name** — Shown to users on the consent screen
- **Redirect URI** — Where Sales AI sends the authorization code after consent
- **Scopes** — What access your app needs (`read`, `write`, `admin`)

You'll receive a `client_id` and `client_secret`. Store the secret securely — it's only shown once.

---

### STEP 2: Implement the Authorization Redirect

Redirect users to the Sales AI authorization endpoint with PKCE:

```typescript
const codeVerifier = generateRandomString(64);
const codeChallenge = await sha256(codeVerifier);

const authUrl = new URL("https://api.sales-ai.app/oauth/authorize");
authUrl.searchParams.set("client_id", YOUR_CLIENT_ID);
authUrl.searchParams.set("redirect_uri", YOUR_REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", "read write");
authUrl.searchParams.set("code_challenge", codeChallenge);
authUrl.searchParams.set("code_challenge_method", "S256");
authUrl.searchParams.set("state", generateRandomString(16));

// Store codeVerifier in session — you'll need it in step 3
redirect(authUrl.toString());
```

---

### STEP 3: Handle the Callback

After the user approves, Sales AI redirects to your `redirect_uri` with `?code=...&state=...`.

Verify the `state` matches what you stored, then exchange the code:

```typescript
const response = await fetch("https://api.sales-ai.app/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: YOUR_CLIENT_ID,
    client_secret: YOUR_CLIENT_SECRET,
    redirect_uri: YOUR_REDIRECT_URI,
    code: authorizationCode,
    code_verifier: storedCodeVerifier,
  }),
});

const { access_token, refresh_token, expires_in } = await response.json();
```

---

### STEP 4: Make Authenticated Requests

Use the `access_token` as the Bearer token on all API calls:

```typescript
const result = await fetch("https://api.sales-ai.app/api/v1/sales/qualify", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ lead: "..." }),
});
```

---

### STEP 5: Refresh Tokens

Access tokens expire. Use the `refresh_token` to get a new one without re-prompting the user:

```typescript
const response = await fetch("https://api.sales-ai.app/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    client_id: YOUR_CLIENT_ID,
    client_secret: YOUR_CLIENT_SECRET,
    refresh_token: storedRefreshToken,
  }),
});
```

---

### TOKEN SCOPES

| Scope | Access |
|---|---|
| `read` | GET requests, job status polling, usage data |
| `write` | All POST endpoints, job submission |
| `admin` | Workspace management, key rotation, user management |

Request only the scopes your app needs.

---

### SUPABASE INTEGRATION NOTE

If your app is also built on Supabase, you can integrate with Sales AI's Supabase OAuth server directly. [Contact us for the Supabase-to-Supabase integration guide →]

---

*End of copy document.*